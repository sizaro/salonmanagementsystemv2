-- Production schema upgrade for the Salehish Salon Management System.
-- Generated from the reviewed additive migrations listed below.
--
-- Preconditions:
--   1. Run the read-only production preflight first and retain its output.
--   2. Take a Render PostgreSQL backup/export before execution.
--   3. Run this entire file once against the intended production database.
--
-- Safety decisions:
--   * Existing legacy advances remain in advances and are not converted.
--   * Only eligible completed service-performer snapshots are copied to
--     employee_earnings. Rows without an employee or positive snapshot stay excluded.
--   * The whole upgrade is transactional: any error rolls back the schema and backfill.

BEGIN;

-- BEGIN SOURCE: 20261008_employee_finance_foundation.sql
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
-- END SOURCE: 20261008_employee_finance_foundation.sql

-- BEGIN SOURCE: 20261008_employee_finance_operations.sql
-- Employee finance operations. This is additive and does not reinterpret
-- legacy advances: existing advances remain historical cash records.

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
  CONSTRAINT employee_advance_requests_status_check
    CHECK (workflow_status IN (
      'REQUESTED', 'APPROVED', 'REJECTED', 'DISBURSED',
      'ACKNOWLEDGED', 'CANCELLED'
    ))
);

CREATE INDEX IF NOT EXISTS employee_advance_requests_salon_status_idx
  ON employee_advance_requests (salon_id, workflow_status, created_at DESC);
CREATE INDEX IF NOT EXISTS employee_advance_requests_employee_idx
  ON employee_advance_requests (salon_id, employee_id, created_at DESC);

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
  CONSTRAINT employee_payments_method_check
    CHECK (payment_method IN ('CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'OTHER')),
  CONSTRAINT employee_payments_status_check
    CHECK (workflow_status IN (
      'REQUESTED', 'APPROVED', 'REJECTED', 'DISBURSED',
      'ACKNOWLEDGED', 'CANCELLED', 'VOIDED'
    ))
);

CREATE INDEX IF NOT EXISTS employee_payments_salon_status_idx
  ON employee_payments (salon_id, workflow_status, created_at DESC);
CREATE INDEX IF NOT EXISTS employee_payments_employee_idx
  ON employee_payments (salon_id, employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS employee_payments_period_idx
  ON employee_payments (financial_period_id);

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_finance_receipts_type_check
    CHECK (receipt_type IN ('ADVANCE', 'PAYMENT')),
  CONSTRAINT employee_finance_receipts_source_check CHECK (
    (receipt_type = 'ADVANCE' AND advance_request_id IS NOT NULL AND employee_payment_id IS NULL)
    OR
    (receipt_type = 'PAYMENT' AND employee_payment_id IS NOT NULL AND advance_request_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS employee_finance_receipts_employee_idx
  ON employee_finance_receipts (salon_id, employee_id, issued_at DESC);
-- END SOURCE: 20261008_employee_finance_operations.sql

-- BEGIN SOURCE: 20261008_employee_advance_settlements.sql
-- Advance recovery is recorded separately from the original disbursement.
-- This preserves the approved advance and makes each repayment, deduction or
-- owner-approved waiver traceable without rewriting employee earnings.

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
  CONSTRAINT employee_advance_settlements_method_check
    CHECK (settlement_method IN ('PAYROLL_DEDUCTION', 'CASH_REPAYMENT', 'WAIVED'))
);

CREATE INDEX IF NOT EXISTS employee_advance_settlements_request_idx
  ON employee_advance_settlements (advance_request_id, settled_at DESC);
CREATE INDEX IF NOT EXISTS employee_advance_settlements_employee_idx
  ON employee_advance_settlements (salon_id, employee_id, settled_at DESC);
-- END SOURCE: 20261008_employee_advance_settlements.sql

-- BEGIN SOURCE: 20261009_employee_finance_signed_receipts.sql
-- Signed receipt evidence is deliberately separate from the financial event.
-- Existing disbursements stay intact and remain valid, even before a receipt
-- receives the newly introduced signature evidence.

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
  CONSTRAINT employee_finance_receipt_signatures_type_check
    CHECK (signature_type IN ('APPROVAL', 'ACKNOWLEDGEMENT')),
  CONSTRAINT employee_finance_receipt_signatures_source_check
    CHECK (
      (advance_request_id IS NOT NULL AND employee_payment_id IS NULL)
      OR
      (employee_payment_id IS NOT NULL AND advance_request_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_finance_advance_approval_signature_once
  ON employee_finance_receipt_signatures (advance_request_id, signature_type)
  WHERE signature_type = 'APPROVAL';

CREATE UNIQUE INDEX IF NOT EXISTS employee_finance_payment_approval_signature_once
  ON employee_finance_receipt_signatures (employee_payment_id, signature_type)
  WHERE signature_type = 'APPROVAL';

CREATE UNIQUE INDEX IF NOT EXISTS employee_finance_receipt_acknowledgement_signature_once
  ON employee_finance_receipt_signatures (receipt_id, signature_type)
  WHERE signature_type = 'ACKNOWLEDGEMENT';

CREATE INDEX IF NOT EXISTS employee_finance_receipt_signatures_receipt_idx
  ON employee_finance_receipt_signatures (salon_id, receipt_id, signed_at DESC);

ALTER TABLE employee_finance_receipts
  ADD COLUMN IF NOT EXISTS document_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_version INTEGER NOT NULL DEFAULT 1;
-- END SOURCE: 20261009_employee_finance_signed_receipts.sql

-- BEGIN SOURCE: 20261012_employee_payroll_deduction_consent.sql
-- Payroll deductions only affect earnings after the receiving employee has
-- explicitly signed consent for the exact linked advance and amount.
-- Existing settlement rows remain effective historical records.

ALTER TABLE employee_advance_settlements
  ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(40) NOT NULL DEFAULT 'EFFECTIVE',
  ADD COLUMN IF NOT EXISTS employee_consented_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS employee_consented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS employee_consent_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS employee_consent_signature_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS employee_consent_declaration TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_advance_settlements_workflow_status_check'
  ) THEN
    ALTER TABLE employee_advance_settlements
      ADD CONSTRAINT employee_advance_settlements_workflow_status_check
      CHECK (workflow_status IN ('PENDING_EMPLOYEE_CONSENT', 'EFFECTIVE'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS employee_advance_settlements_consent_idx
  ON employee_advance_settlements (salon_id, employee_id, workflow_status, settled_at DESC);
-- END SOURCE: 20261012_employee_payroll_deduction_consent.sql

-- BEGIN SOURCE: 20261009_employee_profile_audit.sql
-- A lightweight append-only audit trail for employee record changes.
-- Financial actions retain their own source records and are read alongside
-- this table in the employee profile activity timeline.

CREATE TABLE IF NOT EXISTS employee_activity_log (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_activity_log_employee_idx
  ON employee_activity_log (salon_id, employee_id, created_at DESC);
-- END SOURCE: 20261009_employee_profile_audit.sql

-- BEGIN SOURCE: 20261010_owner_intelligence.sql
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

CREATE INDEX IF NOT EXISTS owner_business_goals_salon_period_idx
  ON owner_business_goals (salon_id, status, period_start, period_end);

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

CREATE INDEX IF NOT EXISTS salon_campaigns_salon_status_dates_idx
  ON salon_campaigns (salon_id, status, starts_at, ends_at);
-- END SOURCE: 20261010_owner_intelligence.sql

COMMIT;
