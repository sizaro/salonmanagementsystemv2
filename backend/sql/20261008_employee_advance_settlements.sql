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
