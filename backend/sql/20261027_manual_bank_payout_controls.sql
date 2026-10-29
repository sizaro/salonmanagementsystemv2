-- Controlled fallback for bank disbursements when no bank payout API is enabled.
-- This is additive and leaves all historical financial records untouched.

BEGIN;

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS manual_execution_status VARCHAR(32) NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS manual_execution_reference VARCHAR(160),
  ADD COLUMN IF NOT EXISTS manual_execution_note TEXT,
  ADD COLUMN IF NOT EXISTS manual_verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manual_verified_at TIMESTAMPTZ;

ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_manual_execution_status_check;
ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_manual_execution_status_check
  CHECK (manual_execution_status IN ('NOT_REQUIRED', 'AWAITING_EXECUTION', 'SUBMITTED', 'VERIFIED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS payment_intents_manual_bank_payout_idx
  ON payment_intents (salon_id, manual_execution_status, created_at DESC)
  WHERE provider = 'BANK_TRANSFER' AND direction = 'DISBURSEMENT';

COMMIT;
