-- Employee fees are liabilities, not an automatic reduction of earnings.
-- This migration intentionally does not backfill historical tag/late rows:
-- a historical report record is not proof that an employee still owes money.

CREATE TABLE IF NOT EXISTS employee_fee_obligations (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  fee_type VARCHAR(24) NOT NULL,
  source_late_fee_id INTEGER REFERENCES late_fees(id) ON DELETE RESTRICT,
  source_tag_fee_id INTEGER REFERENCES tag_fee(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  fee_date DATE NOT NULL,
  fee_time TIME NOT NULL,
  fee_period DATE,
  workflow_status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  CONSTRAINT employee_fee_obligations_type_check
    CHECK (fee_type IN ('LATE_FEE', 'TAG_FEE', 'CLEANER_FEE')),
  CONSTRAINT employee_fee_obligations_status_check
    CHECK (workflow_status IN ('OPEN', 'SETTLEMENT_PENDING', 'SETTLED', 'WAIVED', 'VOIDED')),
  CONSTRAINT employee_fee_obligations_source_check CHECK (
    (fee_type = 'LATE_FEE' AND source_late_fee_id IS NOT NULL AND source_tag_fee_id IS NULL AND fee_period IS NULL)
    OR (fee_type = 'TAG_FEE' AND source_tag_fee_id IS NOT NULL AND source_late_fee_id IS NULL AND fee_period IS NULL)
    OR (fee_type = 'CLEANER_FEE' AND source_late_fee_id IS NULL AND source_tag_fee_id IS NULL AND fee_period IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_fee_obligations_late_source_uq
  ON employee_fee_obligations (source_late_fee_id) WHERE source_late_fee_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS employee_fee_obligations_tag_source_uq
  ON employee_fee_obligations (source_tag_fee_id) WHERE source_tag_fee_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS employee_fee_obligations_cleaner_period_uq
  ON employee_fee_obligations (salon_id, employee_id, fee_type, fee_period)
  WHERE fee_type = 'CLEANER_FEE' AND workflow_status <> 'VOIDED';
CREATE INDEX IF NOT EXISTS employee_fee_obligations_employee_status_idx
  ON employee_fee_obligations (salon_id, employee_id, workflow_status, fee_date DESC, id DESC);

CREATE TABLE IF NOT EXISTS employee_fee_settlements (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  fee_obligation_id BIGINT NOT NULL REFERENCES employee_fee_obligations(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  settlement_method VARCHAR(32) NOT NULL,
  workflow_status VARCHAR(32) NOT NULL,
  notes TEXT,
  receipt_number VARCHAR(80) NOT NULL UNIQUE,
  settled_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_by_signature_url TEXT,
  settled_by_signature_hash VARCHAR(128),
  settled_by_declaration TEXT,
  employee_consented_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  employee_consented_at TIMESTAMPTZ,
  employee_consent_signature_url TEXT,
  employee_consent_signature_hash VARCHAR(128),
  employee_consent_declaration TEXT,
  CONSTRAINT employee_fee_settlements_method_check
    CHECK (settlement_method IN ('PAYROLL_DEDUCTION', 'CASH_REPAYMENT', 'WAIVED')),
  CONSTRAINT employee_fee_settlements_status_check
    CHECK (workflow_status IN ('PENDING_EMPLOYEE_CONSENT', 'EFFECTIVE', 'VOIDED'))
);
CREATE INDEX IF NOT EXISTS employee_fee_settlements_obligation_idx
  ON employee_fee_settlements (fee_obligation_id, workflow_status, settled_at DESC);
CREATE INDEX IF NOT EXISTS employee_fee_settlements_employee_idx
  ON employee_fee_settlements (salon_id, employee_id, workflow_status, settled_at DESC);
