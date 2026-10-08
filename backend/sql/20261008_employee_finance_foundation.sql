-- Employee finance foundation — safe to run once on an existing Salon V2 database.
-- This script is additive. It preserves service, advance and payment records.
-- Existing completed service-performer snapshots are copied once into an immutable
-- earnings ledger; no advance is marked as paid, settled, or acknowledged here.

CREATE TABLE IF NOT EXISTS employee_finance_periods (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  name VARCHAR(160),
  period_type VARCHAR(16) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  workflow_status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_finance_periods_type_check
    CHECK (period_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),
  CONSTRAINT employee_finance_periods_status_check
    CHECK (workflow_status IN (
      'OPEN', 'REVIEWED', 'APPROVED_FOR_PAYMENT',
      'PARTIALLY_PAID', 'FULLY_PAID', 'CLOSED'
    )),
  CONSTRAINT employee_finance_periods_dates_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS employee_finance_periods_salon_dates_idx
  ON employee_finance_periods (salon_id, start_date DESC, end_date DESC);

CREATE INDEX IF NOT EXISTS employee_finance_periods_salon_status_idx
  ON employee_finance_periods (salon_id, workflow_status);

CREATE TABLE IF NOT EXISTS employee_earnings (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- Kept as an immutable source identifier rather than a foreign key because
  -- the legacy service-delete flow remains available during this rollout.
  -- A deleted source must never delete or rewrite finance history.
  source_service_transaction_id INTEGER NOT NULL,
  -- Deliberately not a foreign key: existing service editing replaces performer
  -- rows. The original performer id remains an immutable source reference.
  source_service_performer_id INTEGER NOT NULL,
  source_service_role_id INTEGER,
  source_kind VARCHAR(40) NOT NULL DEFAULT 'SERVICE_PERFORMER',
  earning_date DATE NOT NULL,
  earning_time TIME NOT NULL,
  entry_type VARCHAR(10) NOT NULL DEFAULT 'current',
  amount NUMERIC(14,2) NOT NULL,
  financial_period_id BIGINT REFERENCES employee_finance_periods(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_earnings_source_kind_check
    CHECK (source_kind = 'SERVICE_PERFORMER'),
  CONSTRAINT employee_earnings_entry_type_check
    CHECK (entry_type IN ('current', 'past')),
  CONSTRAINT employee_earnings_amount_check CHECK (amount > 0),
  CONSTRAINT employee_earnings_source_performer_unique
    UNIQUE (salon_id, source_service_performer_id)
);

CREATE INDEX IF NOT EXISTS employee_earnings_employee_date_idx
  ON employee_earnings (salon_id, employee_id, earning_date DESC, earning_time DESC);

CREATE INDEX IF NOT EXISTS employee_earnings_transaction_idx
  ON employee_earnings (source_service_transaction_id);

-- A first local run briefly created this FK. Remove it safely so the additive
-- finance rollout does not change the current service-delete behavior.
ALTER TABLE employee_earnings
  DROP CONSTRAINT IF EXISTS employee_earnings_source_service_transaction_id_fkey;

-- Backfill the same legacy-compatible completed-service rule used in reporting.
-- ON CONFLICT makes reruns safe and prevents duplicate earnings.
INSERT INTO employee_earnings (
  salon_id,
  employee_id,
  source_service_transaction_id,
  source_service_performer_id,
  source_service_role_id,
  earning_date,
  earning_time,
  entry_type,
  amount
)
SELECT
  sp.salon_id,
  COALESCE(sp.employee_id, sp.preferred_employee_id),
  st.id,
  sp.id,
  sp.service_role_id,
  st.service_date,
  st.service_time,
  COALESCE(st.entry_type, 'current'),
  sp.earned_amount_snapshot
FROM service_performers sp
JOIN service_transactions st
  ON st.id = sp.service_transaction_id
 AND st.salon_id = sp.salon_id
WHERE COALESCE(sp.employee_id, sp.preferred_employee_id) IS NOT NULL
  AND COALESCE(sp.earned_amount_snapshot, 0) > 0
  AND st.service_date IS NOT NULL
  AND st.service_time IS NOT NULL
  AND (
    st.status IS NULL
    OR LOWER(TRIM(st.status)) = 'completed'
  )
ON CONFLICT (salon_id, source_service_performer_id) DO NOTHING;
