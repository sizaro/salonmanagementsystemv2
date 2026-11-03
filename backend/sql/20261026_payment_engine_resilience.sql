-- Additive resilience, reporting, and advance-repayment support for the Payment Engine.
-- Existing financial rows are not rewritten.
BEGIN;

ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Kampala';

ALTER TABLE payment_intents
  ADD COLUMN IF NOT EXISTS operation_description VARCHAR(240),
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS provider_fee NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS finalization_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_finalization_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_finalization_attempt_at TIMESTAMPTZ;

ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_verification_status_check;
ALTER TABLE payment_intents ADD CONSTRAINT payment_intents_verification_status_check
  CHECK (verification_status IN ('PENDING', 'VERIFIED', 'DELAYED', 'INVESTIGATION', 'FAILED'));

CREATE INDEX IF NOT EXISTS payment_intents_posting_recovery_idx
  ON payment_intents (posting_status, next_finalization_attempt_at, confirmed_at)
  WHERE payment_status = 'CONFIRMED' AND posting_status <> 'POSTED';

ALTER TABLE bank_incoming_credits
  ADD COLUMN IF NOT EXISTS notification_status VARCHAR(32) NOT NULL DEFAULT 'DELIVERED',
  ADD COLUMN IF NOT EXISTS notification_attempts INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_notification_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_fee NUMERIC(14,2);

ALTER TABLE bank_incoming_credits DROP CONSTRAINT IF EXISTS bank_incoming_credits_notification_status_check;
ALTER TABLE bank_incoming_credits ADD CONSTRAINT bank_incoming_credits_notification_status_check
  CHECK (notification_status IN ('PENDING', 'DELIVERED', 'FAILED', 'RECOVERED'));

ALTER TABLE employee_advance_settlements
  ADD COLUMN IF NOT EXISTS external_payment_intent_id BIGINT
    REFERENCES payment_intents(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS employee_advance_settlements_external_payment_unique
  ON employee_advance_settlements (external_payment_intent_id)
  WHERE external_payment_intent_id IS NOT NULL;

ALTER TABLE employee_advance_settlements
  DROP CONSTRAINT IF EXISTS employee_advance_settlements_method_check;
ALTER TABLE employee_advance_settlements
  ADD CONSTRAINT employee_advance_settlements_method_check
  CHECK (settlement_method IN (
    'PAYROLL_DEDUCTION', 'CASH_REPAYMENT', 'MTN_MOMO',
    'AIRTEL_MONEY', 'BANK_TRANSFER', 'WAIVED'
  ));

COMMIT;
