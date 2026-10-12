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
