-- Additive bank-collection and external-ledger support. Existing records remain untouched.
BEGIN;

CREATE TABLE IF NOT EXISTS salon_bank_accounts (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  bank_name VARCHAR(160) NOT NULL,
  account_name VARCHAR(160) NOT NULL,
  account_number VARCHAR(120) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'UGX',
  branch_name VARCHAR(160),
  verification_mode VARCHAR(40) NOT NULL DEFAULT 'REFERENCE_MATCHING',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT salon_bank_accounts_verification_mode_check CHECK (verification_mode IN ('REFERENCE_MATCHING', 'VIRTUAL_ACCOUNT', 'MANUAL_RECONCILIATION', 'API_INQUIRY'))
);
CREATE UNIQUE INDEX IF NOT EXISTS salon_bank_accounts_one_active_account ON salon_bank_accounts (salon_id, currency) WHERE is_active = TRUE;

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS bank_account_id BIGINT REFERENCES salon_bank_accounts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS bank_payment_reference VARCHAR(80),
  ADD COLUMN IF NOT EXISTS provider_transaction_id VARCHAR(160),
  ADD COLUMN IF NOT EXISTS reconciliation_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reconciled_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_bank_payment_reference_unique ON payment_intents (salon_id, bank_payment_reference) WHERE bank_payment_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS bank_incoming_credits (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  bank_account_id BIGINT NOT NULL REFERENCES salon_bank_accounts(id) ON DELETE RESTRICT,
  provider VARCHAR(24) NOT NULL DEFAULT 'BANK_TRANSFER',
  bank_transaction_id VARCHAR(160) NOT NULL,
  transfer_reference VARCHAR(160),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'UGX',
  credit_status VARCHAR(32) NOT NULL DEFAULT 'CONFIRMED',
  credited_at TIMESTAMPTZ NOT NULL,
  notification_payload JSONB,
  notification_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_payment_intent_id BIGINT REFERENCES payment_intents(id) ON DELETE RESTRICT,
  match_status VARCHAR(32) NOT NULL DEFAULT 'UNMATCHED',
  investigation_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bank_incoming_credits_transaction_unique UNIQUE (provider, bank_transaction_id),
  CONSTRAINT bank_incoming_credits_match_status_check CHECK (match_status IN ('UNMATCHED', 'MATCHED', 'REJECTED', 'INVESTIGATING'))
);
CREATE INDEX IF NOT EXISTS bank_incoming_credits_reconciliation_idx ON bank_incoming_credits (salon_id, match_status, credited_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS bank_incoming_credits_one_intent_unique ON bank_incoming_credits (matched_payment_intent_id) WHERE matched_payment_intent_id IS NOT NULL;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS external_payment_intent_id BIGINT REFERENCES payment_intents(id) ON DELETE RESTRICT;
ALTER TABLE employee_advance_requests ADD COLUMN IF NOT EXISTS external_payment_intent_id BIGINT REFERENCES payment_intents(id) ON DELETE RESTRICT;
ALTER TABLE employee_payments ADD COLUMN IF NOT EXISTS external_payment_intent_id BIGINT REFERENCES payment_intents(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS expenses_external_payment_intent_unique ON expenses (external_payment_intent_id) WHERE external_payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS employee_advance_external_payment_intent_unique ON employee_advance_requests (external_payment_intent_id) WHERE external_payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS employee_payment_external_payment_intent_unique ON employee_payments (external_payment_intent_id) WHERE external_payment_intent_id IS NOT NULL;

-- Existing employee-payment rows keep their historic method labels. New rail
-- values make the provider explicit for future external disbursements.
ALTER TABLE employee_payments DROP CONSTRAINT IF EXISTS employee_payments_method_check;
ALTER TABLE employee_payments ADD CONSTRAINT employee_payments_method_check
  CHECK (payment_method IN ('CASH', 'MOBILE_MONEY', 'MTN_MOMO', 'AIRTEL_MONEY', 'BANK_TRANSFER', 'OTHER'));
COMMIT;
