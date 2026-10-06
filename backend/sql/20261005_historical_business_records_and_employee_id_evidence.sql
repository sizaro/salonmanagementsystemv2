-- Apply this once to the intended Salon V2 PostgreSQL database.
-- It preserves existing records and derives their business date/time from
-- their original created_at values in Africa/Kampala. It never rewrites created_at.

ALTER TABLE service_transactions
  ADD COLUMN IF NOT EXISTS backdate_reason TEXT;

ALTER TABLE advances
  ADD COLUMN IF NOT EXISTS backdate_reason TEXT;

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS expense_date DATE,
  ADD COLUMN IF NOT EXISTS expense_time TIME,
  ADD COLUMN IF NOT EXISTS entry_type VARCHAR(10) NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS backdate_reason TEXT;

UPDATE expenses
SET expense_date = COALESCE(expense_date, (created_at AT TIME ZONE 'Africa/Kampala')::date),
    expense_time = COALESCE(expense_time, (created_at AT TIME ZONE 'Africa/Kampala')::time)
WHERE expense_date IS NULL OR expense_time IS NULL;

ALTER TABLE expenses
  ALTER COLUMN expense_date SET NOT NULL,
  ALTER COLUMN expense_time SET NOT NULL;

ALTER TABLE tag_fee
  ADD COLUMN IF NOT EXISTS fee_date DATE,
  ADD COLUMN IF NOT EXISTS fee_time TIME,
  ADD COLUMN IF NOT EXISTS entry_type VARCHAR(10) NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS backdate_reason TEXT;

UPDATE tag_fee
SET fee_date = COALESCE(fee_date, (created_at AT TIME ZONE 'Africa/Kampala')::date),
    fee_time = COALESCE(fee_time, (created_at AT TIME ZONE 'Africa/Kampala')::time)
WHERE fee_date IS NULL OR fee_time IS NULL;

ALTER TABLE tag_fee
  ALTER COLUMN fee_date SET NOT NULL,
  ALTER COLUMN fee_time SET NOT NULL;

ALTER TABLE late_fees
  ADD COLUMN IF NOT EXISTS fee_date DATE,
  ADD COLUMN IF NOT EXISTS fee_time TIME,
  ADD COLUMN IF NOT EXISTS entry_type VARCHAR(10) NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS backdate_reason TEXT;

UPDATE late_fees
SET fee_date = COALESCE(fee_date, (created_at AT TIME ZONE 'Africa/Kampala')::date),
    fee_time = COALESCE(fee_time, (created_at AT TIME ZONE 'Africa/Kampala')::time)
WHERE fee_date IS NULL OR fee_time IS NULL;

ALTER TABLE late_fees
  ALTER COLUMN fee_date SET NOT NULL,
  ALTER COLUMN fee_time SET NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS id_document_front_url TEXT,
  ADD COLUMN IF NOT EXISTS id_document_back_url TEXT,
  ADD COLUMN IF NOT EXISTS id_document_pdf_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_entry_type_check'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_entry_type_check CHECK (entry_type IN ('current', 'past'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tag_fee_entry_type_check'
  ) THEN
    ALTER TABLE tag_fee
      ADD CONSTRAINT tag_fee_entry_type_check CHECK (entry_type IN ('current', 'past'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'late_fees_entry_type_check'
  ) THEN
    ALTER TABLE late_fees
      ADD CONSTRAINT late_fees_entry_type_check CHECK (entry_type IN ('current', 'past'));
  END IF;
END $$;
