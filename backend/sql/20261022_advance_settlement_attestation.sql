-- Cash repayments and owner waivers become effective immediately. Preserve the
-- authenticated management attestation separately from employee payroll consent.
-- Existing settlement rows stay unchanged and therefore remain historically honest.

ALTER TABLE employee_advance_settlements
  ADD COLUMN IF NOT EXISTS settled_by_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS settled_by_signature_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS settled_by_declaration TEXT;

CREATE INDEX IF NOT EXISTS employee_advance_settlements_effective_evidence_idx
  ON employee_advance_settlements (salon_id, workflow_status, settled_at DESC);
