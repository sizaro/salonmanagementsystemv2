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
