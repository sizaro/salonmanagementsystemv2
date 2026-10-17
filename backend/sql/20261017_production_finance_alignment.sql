-- Salehish production Employee Finance alignment
--
-- Safety properties:
-- * additive only: no DROP, DELETE, UPDATE of legacy source rows, or truncation;
-- * one transaction: an error rolls the entire upgrade back;
-- * historical advances are linked as DISBURSED only, never acknowledged;
-- * no historical receipt, signature, approval, or payroll-deduction consent is invented;
-- * payroll deductions without recorded consent remain PENDING_EMPLOYEE_CONSENT and do not reduce balances.
--
-- Run only after a Render PostgreSQL backup and a saved preflight result.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  missing_table text;
BEGIN
  FOREACH missing_table IN ARRAY ARRAY['salons', 'users', 'advances', 'service_transactions', 'service_performers']
  LOOP
    IF to_regclass('public.' || missing_table) IS NULL THEN
      RAISE EXCEPTION 'Required production table public.% is missing; no changes were applied.', missing_table;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM advances a
    LEFT JOIN users employee ON employee.id = a.employee_id AND employee.salon_id = a.salon_id
    WHERE employee.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more legacy advances cannot be linked to an employee in the same salon. Correct those rows before this upgrade.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM advances a
    JOIN salons s ON s.id = a.salon_id
    WHERE NOT EXISTS (
      SELECT 1 FROM users owner_user
      WHERE owner_user.id = s.owner_user_id AND owner_user.salon_id = s.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM users owner_user
      WHERE owner_user.salon_id = s.id AND LOWER(COALESCE(owner_user.role, '')) = 'owner'
    )
  ) THEN
    RAISE EXCEPTION 'A salon with legacy advances has no owner account for technical migration attribution. Correct ownership before this upgrade.';
  END IF;
END $$;

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
  CONSTRAINT employee_finance_periods_type_check CHECK (period_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM')),
  CONSTRAINT employee_finance_periods_status_check CHECK (workflow_status IN ('OPEN', 'REVIEWED', 'APPROVED_FOR_PAYMENT', 'PARTIALLY_PAID', 'FULLY_PAID', 'CLOSED')),
  CONSTRAINT employee_finance_periods_dates_check CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS employee_finance_periods_salon_dates_idx ON employee_finance_periods (salon_id, start_date DESC, end_date DESC);
CREATE INDEX IF NOT EXISTS employee_finance_periods_salon_status_idx ON employee_finance_periods (salon_id, workflow_status);

CREATE TABLE IF NOT EXISTS employee_earnings (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source_service_transaction_id INTEGER NOT NULL,
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
  CONSTRAINT employee_earnings_source_kind_check CHECK (source_kind = 'SERVICE_PERFORMER'),
  CONSTRAINT employee_earnings_entry_type_check CHECK (entry_type IN ('current', 'past')),
  CONSTRAINT employee_earnings_amount_check CHECK (amount > 0),
  CONSTRAINT employee_earnings_source_performer_unique UNIQUE (salon_id, source_service_performer_id)
);
CREATE INDEX IF NOT EXISTS employee_earnings_employee_date_idx ON employee_earnings (salon_id, employee_id, earning_date DESC, earning_time DESC);
CREATE INDEX IF NOT EXISTS employee_earnings_transaction_idx ON employee_earnings (source_service_transaction_id);
ALTER TABLE employee_earnings DROP CONSTRAINT IF EXISTS employee_earnings_source_service_transaction_id_fkey;

CREATE TABLE IF NOT EXISTS employee_advance_requests (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requested_amount NUMERIC(14,2) NOT NULL CHECK (requested_amount > 0),
  reason TEXT,
  workflow_status VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  advance_id INTEGER REFERENCES advances(id) ON DELETE RESTRICT,
  disbursed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  disbursed_at TIMESTAMPTZ,
  acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  receipt_number VARCHAR(80) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_advance_requests_status_check CHECK (workflow_status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'DISBURSED', 'ACKNOWLEDGED', 'CANCELLED'))
);
CREATE INDEX IF NOT EXISTS employee_advance_requests_salon_status_idx ON employee_advance_requests (salon_id, workflow_status, created_at DESC);
CREATE INDEX IF NOT EXISTS employee_advance_requests_employee_idx ON employee_advance_requests (salon_id, employee_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS employee_advance_requests_legacy_advance_unique ON employee_advance_requests (salon_id, advance_id) WHERE advance_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS employee_payments (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  financial_period_id BIGINT REFERENCES employee_finance_periods(id) ON DELETE SET NULL,
  requested_amount NUMERIC(14,2) NOT NULL CHECK (requested_amount > 0),
  payment_method VARCHAR(24) NOT NULL DEFAULT 'CASH',
  payment_reference VARCHAR(160),
  notes TEXT,
  workflow_status VARCHAR(24) NOT NULL DEFAULT 'REQUESTED',
  requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  disbursed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  disbursed_at TIMESTAMPTZ,
  acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  receipt_number VARCHAR(80) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_payments_method_check CHECK (payment_method IN ('CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'OTHER')),
  CONSTRAINT employee_payments_status_check CHECK (workflow_status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'DISBURSED', 'ACKNOWLEDGED', 'CANCELLED', 'VOIDED'))
);
CREATE INDEX IF NOT EXISTS employee_payments_salon_status_idx ON employee_payments (salon_id, workflow_status, created_at DESC);
CREATE INDEX IF NOT EXISTS employee_payments_employee_idx ON employee_payments (salon_id, employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS employee_payments_period_idx ON employee_payments (financial_period_id);

CREATE TABLE IF NOT EXISTS employee_finance_receipts (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  receipt_number VARCHAR(80) NOT NULL UNIQUE,
  receipt_type VARCHAR(24) NOT NULL,
  advance_request_id BIGINT REFERENCES employee_advance_requests(id) ON DELETE RESTRICT,
  employee_payment_id BIGINT REFERENCES employee_payments(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  document_hash CHAR(64),
  pdf_url TEXT,
  finalized_at TIMESTAMPTZ,
  document_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_finance_receipts_type_check CHECK (receipt_type IN ('ADVANCE', 'PAYMENT')),
  CONSTRAINT employee_finance_receipts_source_check CHECK ((receipt_type = 'ADVANCE' AND advance_request_id IS NOT NULL AND employee_payment_id IS NULL) OR (receipt_type = 'PAYMENT' AND employee_payment_id IS NOT NULL AND advance_request_id IS NULL))
);
CREATE INDEX IF NOT EXISTS employee_finance_receipts_employee_idx ON employee_finance_receipts (salon_id, employee_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS employee_advance_settlements (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  advance_request_id BIGINT NOT NULL REFERENCES employee_advance_requests(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  settlement_method VARCHAR(32) NOT NULL,
  notes TEXT,
  receipt_number VARCHAR(80) NOT NULL UNIQUE,
  settled_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  workflow_status VARCHAR(40) NOT NULL DEFAULT 'PENDING_EMPLOYEE_CONSENT',
  employee_consented_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  employee_consented_at TIMESTAMPTZ,
  employee_consent_signature_url TEXT,
  employee_consent_signature_hash CHAR(64),
  employee_consent_declaration TEXT,
  CONSTRAINT employee_advance_settlements_method_check CHECK (settlement_method IN ('PAYROLL_DEDUCTION', 'CASH_REPAYMENT', 'WAIVED')),
  CONSTRAINT employee_advance_settlements_workflow_status_check CHECK (workflow_status IN ('PENDING_EMPLOYEE_CONSENT', 'EFFECTIVE'))
);
ALTER TABLE employee_advance_settlements
  ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(40),
  ADD COLUMN IF NOT EXISTS employee_consented_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_consented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS employee_consent_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS employee_consent_signature_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS employee_consent_declaration TEXT;
UPDATE employee_advance_settlements
SET workflow_status = CASE
  WHEN settlement_method = 'PAYROLL_DEDUCTION' AND employee_consented_at IS NULL THEN 'PENDING_EMPLOYEE_CONSENT'
  ELSE 'EFFECTIVE'
END
WHERE workflow_status IS NULL;
ALTER TABLE employee_advance_settlements
  ALTER COLUMN workflow_status SET DEFAULT 'PENDING_EMPLOYEE_CONSENT',
  ALTER COLUMN workflow_status SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_advance_settlements_workflow_status_check') THEN
    ALTER TABLE employee_advance_settlements ADD CONSTRAINT employee_advance_settlements_workflow_status_check CHECK (workflow_status IN ('PENDING_EMPLOYEE_CONSENT', 'EFFECTIVE'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS employee_advance_settlements_request_idx ON employee_advance_settlements (advance_request_id, settled_at DESC);
CREATE INDEX IF NOT EXISTS employee_advance_settlements_employee_idx ON employee_advance_settlements (salon_id, employee_id, settled_at DESC);
CREATE INDEX IF NOT EXISTS employee_advance_settlements_consent_idx ON employee_advance_settlements (salon_id, employee_id, workflow_status, settled_at DESC);

CREATE TABLE IF NOT EXISTS employee_activity_log (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS employee_activity_log_employee_idx ON employee_activity_log (salon_id, employee_id, created_at DESC);

CREATE TABLE IF NOT EXISTS employee_finance_receipt_signatures (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  receipt_id BIGINT REFERENCES employee_finance_receipts(id) ON DELETE RESTRICT,
  advance_request_id BIGINT REFERENCES employee_advance_requests(id) ON DELETE RESTRICT,
  employee_payment_id BIGINT REFERENCES employee_payments(id) ON DELETE RESTRICT,
  signer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  signer_role VARCHAR(32) NOT NULL,
  signature_type VARCHAR(24) NOT NULL,
  signature_url TEXT NOT NULL,
  signature_hash CHAR(64) NOT NULL,
  declaration TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_finance_receipt_signatures_type_check CHECK (signature_type IN ('APPROVAL', 'ACKNOWLEDGEMENT')),
  CONSTRAINT employee_finance_receipt_signatures_source_check CHECK ((advance_request_id IS NOT NULL AND employee_payment_id IS NULL) OR (employee_payment_id IS NOT NULL AND advance_request_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS employee_finance_advance_approval_signature_once ON employee_finance_receipt_signatures (advance_request_id, signature_type) WHERE signature_type = 'APPROVAL';
CREATE UNIQUE INDEX IF NOT EXISTS employee_finance_payment_approval_signature_once ON employee_finance_receipt_signatures (employee_payment_id, signature_type) WHERE signature_type = 'APPROVAL';
CREATE UNIQUE INDEX IF NOT EXISTS employee_finance_receipt_acknowledgement_signature_once ON employee_finance_receipt_signatures (receipt_id, signature_type) WHERE signature_type = 'ACKNOWLEDGEMENT';
CREATE INDEX IF NOT EXISTS employee_finance_receipt_signatures_receipt_idx ON employee_finance_receipt_signatures (salon_id, receipt_id, signed_at DESC);

CREATE TABLE IF NOT EXISTS owner_business_goals (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  title VARCHAR(160) NOT NULL,
  metric VARCHAR(24) NOT NULL CHECK (metric IN ('REVENUE', 'CLIENTS', 'SERVICES')),
  target_value NUMERIC(14,2) NOT NULL CHECK (target_value > 0),
  period_type VARCHAR(16) NOT NULL CHECK (period_type IN ('WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL CHECK (period_end >= period_start),
  rationale TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS owner_business_goals_salon_period_idx ON owner_business_goals (salon_id, status, period_start, period_end);

CREATE TABLE IF NOT EXISTS salon_campaigns (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  campaign_type VARCHAR(16) NOT NULL CHECK (campaign_type IN ('ADVERT', 'EVENT', 'OFFER')),
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  discount_percent NUMERIC(5,2) CHECK (discount_percent IS NULL OR (discount_percent > 0 AND discount_percent <= 100)),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at >= starts_at),
  status VARCHAR(16) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ENDED', 'ARCHIVED')),
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS salon_campaigns_salon_status_dates_idx ON salon_campaigns (salon_id, status, starts_at, ends_at);

-- Immutable completed-service earnings backfill. Reruns do not duplicate rows.
INSERT INTO employee_earnings (
  salon_id, employee_id, source_service_transaction_id, source_service_performer_id,
  source_service_role_id, earning_date, earning_time, entry_type, amount
)
SELECT
  sp.salon_id, COALESCE(sp.employee_id, sp.preferred_employee_id), st.id, sp.id,
  sp.service_role_id, st.service_date, st.service_time, COALESCE(st.entry_type, 'current'), sp.earned_amount_snapshot
FROM service_performers sp
JOIN service_transactions st ON st.id = sp.service_transaction_id AND st.salon_id = sp.salon_id
WHERE COALESCE(sp.employee_id, sp.preferred_employee_id) IS NOT NULL
  AND COALESCE(sp.earned_amount_snapshot, 0) > 0
  AND st.service_date IS NOT NULL
  AND st.service_time IS NOT NULL
  AND (st.status IS NULL OR LOWER(TRIM(st.status)) = 'completed')
ON CONFLICT (salon_id, source_service_performer_id) DO NOTHING;

-- Historical advance backfill. Legacy rows prove issuance only. They are not
-- marked acknowledged, approved, repaid, waived, signed, or payroll-consented.
WITH migration_actor AS (
  SELECT s.id AS salon_id,
         COALESCE(
           (SELECT u.id FROM users u WHERE u.id = s.owner_user_id AND u.salon_id = s.id),
           (SELECT u.id FROM users u WHERE u.salon_id = s.id AND LOWER(COALESCE(u.role, '')) = 'owner' ORDER BY u.id LIMIT 1)
         ) AS actor_id
  FROM salons s
)
INSERT INTO employee_advance_requests (
  salon_id, employee_id, requested_amount, reason, workflow_status, requested_by,
  advance_id, disbursed_at, created_at, updated_at
)
SELECT
  a.salon_id,
  a.employee_id,
  a.amount,
  CONCAT('Historical legacy advance #', a.id, '. ', COALESCE(NULLIF(TRIM(a.description), ''), 'No legacy description.'), ' This imported record proves disbursement only; no request, approval, acknowledgement, signature, repayment, waiver, or payroll-deduction consent is inferred. The requested_by field is technical migration attribution required by the schema, not evidence that the attributed owner requested, approved, or disbursed this advance.'),
  'DISBURSED',
  actor.actor_id,
  a.id,
  ((a.advance_date + a.advance_time) AT TIME ZONE 'Africa/Kampala'),
  COALESCE(a.created_at, ((a.advance_date + a.advance_time) AT TIME ZONE 'Africa/Kampala')),
  NOW()
FROM advances a
JOIN users employee ON employee.id = a.employee_id AND employee.salon_id = a.salon_id
JOIN migration_actor actor ON actor.salon_id = a.salon_id AND actor.actor_id IS NOT NULL
LEFT JOIN employee_advance_requests existing ON existing.salon_id = a.salon_id AND existing.advance_id = a.id
WHERE existing.id IS NULL;

COMMIT;
