-- Salehish employee-finance cutover
--
-- The former application automatically treated completed-service earnings as
-- paid and legacy advances as recovered from those earnings.  This migration
-- closes that historic accounting era without inventing approvals, receipts,
-- employee signatures, or payroll-deduction consent.
--
-- All records on and after 2026-10-09 remain in the controlled workflow.
-- The migration is additive and idempotent.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.employee_earnings') IS NULL
     OR to_regclass('public.advances') IS NULL
     OR to_regclass('public.users') IS NULL
     OR to_regclass('public.salons') IS NULL THEN
    RAISE EXCEPTION 'Employee-finance foundation tables are required before the cutover.';
  END IF;

  IF to_regclass('public.employee_advance_requests') IS NULL
     OR to_regclass('public.employee_payments') IS NULL
     OR to_regclass('public.employee_advance_settlements') IS NULL THEN
    RAISE EXCEPTION 'Employee-finance operations tables are required before the cutover.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employee_advance_requests'
      AND column_name = 'entry_type'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employee_advance_requests'
      AND column_name = 'manual_receipt_url'
  ) THEN
    RAISE EXCEPTION 'Run the historical employee-finance migration before this cutover.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('employee_advance_requests', 'business_occurred_at'),
        ('employee_advance_requests', 'disbursed_at'),
        ('employee_advance_requests', 'workflow_status'),
        ('employee_payments', 'business_occurred_at'),
        ('employee_payments', 'disbursed_at'),
        ('employee_payments', 'workflow_status'),
        ('employee_advance_settlements', 'settled_at'),
        ('employee_advance_settlements', 'workflow_status')
    ) AS required_column(table_name, column_name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns column_info
      WHERE column_info.table_schema = 'public'
        AND column_info.table_name = required_column.table_name
        AND column_info.column_name = required_column.column_name
    )
  ) THEN
    RAISE EXCEPTION 'Run the employee-finance operations, settlement, and historical migrations before this cutover.';
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

-- A salon has one accounting cutover.  Reruns keep the original effective date
-- and never overwrite a previously audited snapshot.
INSERT INTO employee_finance_cutovers (
  salon_id, effective_from_date, legacy_ends_on, reason
)
SELECT
  s.id,
  DATE '2026-10-09',
  DATE '2026-10-08',
  'Legacy automatic employee-finance workflow closed. Pre-cutover employee earnings are treated as historically paid and pre-cutover legacy advances as historically settled. No approval, receipt, signature, acknowledgement, or payroll-deduction consent is implied.'
FROM salons s
WHERE EXISTS (
  SELECT 1 FROM employee_earnings ee WHERE ee.salon_id = s.id
)
   OR EXISTS (
  SELECT 1 FROM advances a WHERE a.salon_id = s.id
)
ON CONFLICT (salon_id) DO NOTHING;

-- Snapshot staff-only balances. Owners are deliberately excluded because they
-- are not employee-finance recipients.
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
  JOIN employee_finance_cutovers c
    ON c.salon_id = ee.salon_id
  WHERE ee.earning_date <= c.legacy_ends_on
  GROUP BY ee.salon_id, ee.employee_id
),
historic_advances AS (
  SELECT a.salon_id, a.employee_id,
         COALESCE(SUM(a.amount), 0)::numeric AS amount,
         COUNT(*)::integer AS entries
  FROM advances a
  JOIN employee_finance_cutovers c
    ON c.salon_id = a.salon_id
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
