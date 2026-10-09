-- Signed receipt evidence is deliberately separate from the financial event.
-- Existing disbursements stay intact and remain valid, even before a receipt
-- receives the newly introduced signature evidence.

CREATE TABLE IF NOT EXISTS employee_finance_receipt_signatures (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  receipt_id BIGINT REFERENCES employee_finance_receipts(id) ON DELETE RESTRICT,
  advance_request_id BIGINT REFERENCES employee_advance_requests(id) ON DELETE RESTRICT,
  employee_payment_id BIGINT REFERENCES employee_payments(id) ON DELETE RESTRICT,
  signer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  signer_role VARCHAR(32) NOT NULL,
  signature_type VARCHAR(24) NOT NULL,
  signature_url TEXT NOT NULL,
  signature_hash CHAR(64) NOT NULL,
  declaration TEXT NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_finance_receipt_signatures_type_check
    CHECK (signature_type IN ('APPROVAL', 'ACKNOWLEDGEMENT')),
  CONSTRAINT employee_finance_receipt_signatures_source_check
    CHECK (
      (advance_request_id IS NOT NULL AND employee_payment_id IS NULL)
      OR
      (employee_payment_id IS NOT NULL AND advance_request_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_finance_advance_approval_signature_once
  ON employee_finance_receipt_signatures (advance_request_id, signature_type)
  WHERE signature_type = 'APPROVAL';

CREATE UNIQUE INDEX IF NOT EXISTS employee_finance_payment_approval_signature_once
  ON employee_finance_receipt_signatures (employee_payment_id, signature_type)
  WHERE signature_type = 'APPROVAL';

CREATE UNIQUE INDEX IF NOT EXISTS employee_finance_receipt_acknowledgement_signature_once
  ON employee_finance_receipt_signatures (receipt_id, signature_type)
  WHERE signature_type = 'ACKNOWLEDGEMENT';

CREATE INDEX IF NOT EXISTS employee_finance_receipt_signatures_receipt_idx
  ON employee_finance_receipt_signatures (salon_id, receipt_id, signed_at DESC);

ALTER TABLE employee_finance_receipts
  ADD COLUMN IF NOT EXISTS document_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS document_version INTEGER NOT NULL DEFAULT 1;
