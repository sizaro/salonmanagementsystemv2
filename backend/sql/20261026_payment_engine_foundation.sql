-- Central payment engine foundation.
-- This migration is additive: existing financial rows remain untouched.

BEGIN;

CREATE TABLE IF NOT EXISTS payment_intents (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  intent_reference VARCHAR(80) NOT NULL UNIQUE,
  idempotency_key VARCHAR(120) NOT NULL,
  origin_type VARCHAR(40) NOT NULL,
  origin_action VARCHAR(60) NOT NULL,
  direction VARCHAR(20) NOT NULL,
  provider VARCHAR(24) NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'UGX',
  counterparty_identifier VARCHAR(160),
  counterparty_name VARCHAR(160),
  operation_payload JSONB NOT NULL,
  provider_reference VARCHAR(160),
  payment_status VARCHAR(32) NOT NULL DEFAULT 'CREATED',
  posting_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  failure_code VARCHAR(80),
  failure_message TEXT,
  initiated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  confirmed_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_intents_direction_check
    CHECK (direction IN ('COLLECTION', 'DISBURSEMENT')),
  CONSTRAINT payment_intents_provider_check
    CHECK (provider IN ('MTN_MOMO', 'AIRTEL_MONEY', 'BANK_TRANSFER', 'MOCK')),
  CONSTRAINT payment_intents_payment_status_check
    CHECK (payment_status IN ('CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED', 'EXPIRED', 'UNKNOWN')),
  CONSTRAINT payment_intents_posting_status_check
    CHECK (posting_status IN ('PENDING', 'FINALIZING', 'POSTED', 'FAILED')),
  CONSTRAINT payment_intents_idempotency_unique UNIQUE (salon_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS payment_intents_salon_created_idx
  ON payment_intents (salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_intents_salon_provider_status_idx
  ON payment_intents (salon_id, provider, payment_status, created_at DESC);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id BIGSERIAL PRIMARY KEY,
  payment_intent_id BIGINT NOT NULL REFERENCES payment_intents(id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL,
  provider VARCHAR(24) NOT NULL,
  provider_reference VARCHAR(160),
  attempt_status VARCHAR(32) NOT NULL,
  request_metadata JSONB,
  response_metadata JSONB,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_attempts_number_unique UNIQUE (payment_intent_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS payment_provider_events (
  id BIGSERIAL PRIMARY KEY,
  payment_intent_id BIGINT REFERENCES payment_intents(id) ON DELETE RESTRICT,
  provider VARCHAR(24) NOT NULL,
  provider_event_id VARCHAR(160) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  event_payload JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_result VARCHAR(32),
  CONSTRAINT payment_provider_events_dedup_unique UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id BIGSERIAL PRIMARY KEY,
  payment_intent_id BIGINT NOT NULL REFERENCES payment_intents(id) ON DELETE RESTRICT,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  source_type VARCHAR(40) NOT NULL,
  source_id BIGINT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_allocations_intent_unique UNIQUE (payment_intent_id)
);

CREATE INDEX IF NOT EXISTS payment_allocations_source_idx
  ON payment_allocations (salon_id, source_type, source_id);

CREATE TABLE IF NOT EXISTS payment_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  payment_intent_id BIGINT NOT NULL REFERENCES payment_intents(id) ON DELETE RESTRICT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE service_transactions
  ADD COLUMN IF NOT EXISTS external_payment_intent_id BIGINT
    REFERENCES payment_intents(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS service_transactions_external_payment_intent_unique
  ON service_transactions (external_payment_intent_id)
  WHERE external_payment_intent_id IS NOT NULL;

COMMIT;
