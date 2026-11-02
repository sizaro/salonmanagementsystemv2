-- Production-only replacement for 20261021_employee_finance_cutover.sql.
--
-- Use this file instead of the older fixed-date cutover. It derives each
-- salon's boundary from the latest legacy earning or advance already present
-- in the target database. It does not create receipts, signatures,
-- acknowledgements, employee payments, or individual settlement records.
--
-- The cutover snapshot records that the old application treated historical
-- employee earnings as paid and historical advances as recovered through its
-- automatic deduction behaviour. New activity after the cutover must use the
-- controlled employee-finance workflow.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.employee_earnings') IS NULL
     OR to_regclass('public.advances') IS NULL
     OR to_regclass('public.users') IS NULL
     OR to_regclass('public.salons') IS NULL THEN
    RAISE EXCEPTION 'Employee earnings, advances, users, and salons are required before the legacy finance cutover.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS employee_finance_cutovers (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL UNIQUE REFERENCES salons(id) ON DELETE RESTRICT,
  effective_from_date DATE NOT NULL,
  legacy_ends_on DATE NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_finance_cutovers_dates_check
    CHECK (legacy_ends_on < effective_from_date)
);

CREATE TABLE IF NOT EXISTS employee_finance_cutover_employee_balances (
  id BIGSERIAL PRIMARY KEY,
  cutover_id BIGINT NOT NULL REFERENCES employee_finance_cutovers(id) ON DELETE RESTRICT,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  historical_earnings_paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0
    CHECK (historical_earnings_paid_amount >= 0),
  historical_advance_settled_amount NUMERIC(14,2) NOT NULL DEFAULT 0
    CHECK (historical_advance_settled_amount >= 0),
  historical_earning_entries INTEGER NOT NULL DEFAULT 0
    CHECK (historical_earning_entries >= 0),
  historical_advance_entries INTEGER NOT NULL DEFAULT 0
    CHECK (historical_advance_entries >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_finance_cutover_employee_unique UNIQUE (cutover_id, employee_id)
);

CREATE INDEX IF NOT EXISTS employee_finance_cutover_balances_salon_employee_idx
  ON employee_finance_cutover_employee_balances (salon_id, employee_id);

-- A cutover is deliberately one-time. Re-running this file never changes the
-- original historical snapshot.
WITH earning_dates AS (
  SELECT salon_id, MAX(earning_date) AS latest_earning_date
  FROM employee_earnings
  GROUP BY salon_id
),
advance_dates AS (
  SELECT salon_id, MAX(advance_date) AS latest_advance_date
  FROM advances
  GROUP BY salon_id
),
boundaries AS (
  SELECT s.id AS salon_id,
         GREATEST(
           COALESCE(e.latest_earning_date, DATE '0001-01-01'),
           COALESCE(a.latest_advance_date, DATE '0001-01-01')
         ) AS legacy_ends_on
  FROM salons s
  LEFT JOIN earning_dates e ON e.salon_id = s.id
  LEFT JOIN advance_dates a ON a.salon_id = s.id
)
INSERT INTO employee_finance_cutovers (
  salon_id, effective_from_date, legacy_ends_on, reason
)
SELECT
  b.salon_id,
  b.legacy_ends_on + 1,
  b.legacy_ends_on,
  'Production legacy finance cutover. Historical employee earnings are recorded as paid and historical advances as settled because the former application automatically deducted advances from employee earnings. This migration does not imply a request, approval, acknowledgement, receipt, employee signature, payroll-deduction consent, waiver, or individual settlement allocation.'
FROM boundaries b
WHERE b.legacy_ends_on > DATE '0001-01-01'
ON CONFLICT (salon_id) DO NOTHING;

WITH staff AS (
  SELECT u.id AS employee_id, u.salon_id
  FROM users u
  WHERE LOWER(COALESCE(u.role, '')) IN ('employee', 'manager', 'cashier')
),
historic_earnings AS (
  SELECT ee.salon_id, ee.employee_id,
         COALESCE(SUM(ee.amount), 0)::numeric AS amount,
         COUNT(*)::integer AS entries
  FROM employee_earnings ee
  JOIN employee_finance_cutovers c ON c.salon_id = ee.salon_id
  WHERE ee.earning_date <= c.legacy_ends_on
  GROUP BY ee.salon_id, ee.employee_id
),
historic_advances AS (
  SELECT a.salon_id, a.employee_id,
         COALESCE(SUM(a.amount), 0)::numeric AS amount,
         COUNT(*)::integer AS entries
  FROM advances a
  JOIN employee_finance_cutovers c ON c.salon_id = a.salon_id
  WHERE a.advance_date <= c.legacy_ends_on
  GROUP BY a.salon_id, a.employee_id
)
INSERT INTO employee_finance_cutover_employee_balances (
  cutover_id, salon_id, employee_id,
  historical_earnings_paid_amount, historical_advance_settled_amount,
  historical_earning_entries, historical_advance_entries
)
SELECT
  c.id,
  staff.salon_id,
  staff.employee_id,
  COALESCE(e.amount, 0),
  COALESCE(a.amount, 0),
  COALESCE(e.entries, 0),
  COALESCE(a.entries, 0)
FROM staff
JOIN employee_finance_cutovers c ON c.salon_id = staff.salon_id
LEFT JOIN historic_earnings e
  ON e.salon_id = staff.salon_id AND e.employee_id = staff.employee_id
LEFT JOIN historic_advances a
  ON a.salon_id = staff.salon_id AND a.employee_id = staff.employee_id
WHERE COALESCE(e.entries, 0) > 0 OR COALESCE(a.entries, 0) > 0
ON CONFLICT (cutover_id, employee_id) DO NOTHING;

COMMIT;
