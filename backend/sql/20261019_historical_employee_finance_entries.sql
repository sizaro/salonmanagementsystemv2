-- Additive historical-entry support. Existing live workflow and legacy advances are untouched.
BEGIN;
ALTER TABLE employee_advance_requests
  ADD COLUMN IF NOT EXISTS entry_type VARCHAR(16) NOT NULL DEFAULT 'CURRENT',
  ADD COLUMN IF NOT EXISTS business_occurred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS late_entry_reason TEXT,
  ADD COLUMN IF NOT EXISTS manual_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS manual_receipt_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS manual_receipt_mime_type VARCHAR(80);

ALTER TABLE employee_payments
  ADD COLUMN IF NOT EXISTS entry_type VARCHAR(16) NOT NULL DEFAULT 'CURRENT',
  ADD COLUMN IF NOT EXISTS business_occurred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS late_entry_reason TEXT,
  ADD COLUMN IF NOT EXISTS manual_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS manual_receipt_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS manual_receipt_mime_type VARCHAR(80);

ALTER TABLE employee_finance_receipts
  ADD COLUMN IF NOT EXISTS manual_receipt_url TEXT,
  ADD COLUMN IF NOT EXISTS manual_receipt_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS manual_receipt_mime_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS manual_receipt_verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manual_receipt_verified_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_advance_requests_entry_type_check') THEN
    ALTER TABLE employee_advance_requests ADD CONSTRAINT employee_advance_requests_entry_type_check CHECK (entry_type IN ('CURRENT', 'PAST'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employee_payments_entry_type_check') THEN
    ALTER TABLE employee_payments ADD CONSTRAINT employee_payments_entry_type_check CHECK (entry_type IN ('CURRENT', 'PAST'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS employee_advance_requests_business_occurred_idx ON employee_advance_requests (salon_id, business_occurred_at DESC);
CREATE INDEX IF NOT EXISTS employee_payments_business_occurred_idx ON employee_payments (salon_id, business_occurred_at DESC);

COMMIT;
