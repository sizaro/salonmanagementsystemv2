-- Additive appointment-production hardening. Existing bookings retain the
-- current 08:00-23:30, 30-minute, 60-minute-service behaviour by default.

BEGIN;

CREATE TABLE IF NOT EXISTS salon_appointment_settings (
  salon_id INTEGER PRIMARY KEY REFERENCES salons(id) ON DELETE RESTRICT,
  opening_time TIME NOT NULL DEFAULT '08:00',
  closing_time TIME NOT NULL DEFAULT '23:30',
  slot_interval_minutes SMALLINT NOT NULL DEFAULT 30,
  minimum_notice_minutes INTEGER NOT NULL DEFAULT 60,
  maximum_booking_days INTEGER NOT NULL DEFAULT 90,
  customer_cancellation_notice_minutes INTEGER NOT NULL DEFAULT 0,
  allow_unassigned_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT salon_appointment_settings_hours_check CHECK (opening_time < closing_time),
  CONSTRAINT salon_appointment_settings_slot_check CHECK (slot_interval_minutes IN (15, 30, 60)),
  CONSTRAINT salon_appointment_settings_notice_check CHECK (minimum_notice_minutes BETWEEN 0 AND 10080),
  CONSTRAINT salon_appointment_settings_horizon_check CHECK (maximum_booking_days BETWEEN 1 AND 730),
  CONSTRAINT salon_appointment_settings_cancellation_notice_check CHECK (customer_cancellation_notice_minutes BETWEEN 0 AND 10080)
);

INSERT INTO salon_appointment_settings (salon_id)
SELECT id FROM salons
ON CONFLICT (salon_id) DO NOTHING;

ALTER TABLE service_definitions
  ADD COLUMN IF NOT EXISTS appointment_duration_minutes SMALLINT NOT NULL DEFAULT 60;
ALTER TABLE service_definitions DROP CONSTRAINT IF EXISTS service_definitions_appointment_duration_check;
ALTER TABLE service_definitions ADD CONSTRAINT service_definitions_appointment_duration_check
  CHECK (appointment_duration_minutes BETWEEN 15 AND 480);

ALTER TABLE service_transactions
  ADD COLUMN IF NOT EXISTS appointment_idempotency_key VARCHAR(120);
CREATE UNIQUE INDEX IF NOT EXISTS service_transactions_customer_booking_idempotency_unique
  ON service_transactions (salon_id, customer_id, appointment_idempotency_key)
  WHERE appointment_idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS appointment_events (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  service_transaction_id INTEGER NOT NULL REFERENCES service_transactions(id) ON DELETE RESTRICT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(48) NOT NULL,
  from_status VARCHAR(32),
  to_status VARCHAR(32),
  reason TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS appointment_events_transaction_idx
  ON appointment_events (service_transaction_id, created_at DESC);

ALTER TABLE service_transactions DROP CONSTRAINT IF EXISTS service_transactions_appointment_status_check;
ALTER TABLE service_transactions ADD CONSTRAINT service_transactions_appointment_status_check
  CHECK (status IS NULL OR status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')) NOT VALID;

COMMIT;
