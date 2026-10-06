-- One-time recovery upgrade for salon_db_test_prod.backup (16 September 2026).
-- Run ONLY after restoring that backup into a new, empty target database.
-- It preserves the backup's business records and upgrades its structure to the
-- current Salon V2 schema. It never rewrites created_at.

BEGIN;

-- ---------------------------------------------------------------------------
-- Preserve legacy service creators before the modern foreign key is applied.
-- The backup's services refer to usermain; the current application uses users.
-- Legacy accounts are copied into users with new IDs, then service creators are
-- remapped to those real current-user records.
-- ---------------------------------------------------------------------------
INSERT INTO users (
  first_name, middle_name, last_name, email, password, birthdate, contact,
  next_of_kin, next_of_kin_contact, role, specialty, status, bio, image_url,
  salon_id, created_at, gender
)
SELECT
  um.first_name, um.middle_name, um.last_name, um.email, um.password,
  um.birthdate, um.contact, um.next_of_kin, um.next_of_kin_contact, um.role,
  um.specialty, COALESCE(um.status, 'active'), um.bio, um.image_url,
  um.salon_id, um.created_at, NULL
FROM usermain um
WHERE NOT EXISTS (
  SELECT 1
  FROM users u
  WHERE lower(trim(u.email)) = lower(trim(um.email))
);

CREATE TEMP TABLE legacy_creator_map ON COMMIT DROP AS
SELECT um.id AS legacy_user_id, u.id AS current_user_id
FROM usermain um
JOIN users u
  ON lower(trim(u.email)) = lower(trim(um.email));

-- The old key points to usermain, so remove it before changing creator IDs.
-- The current users-based keys are added back after all records are valid.
DO $$
DECLARE constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT DISTINCT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.constraint_schema = tc.constraint_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'service_transactions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name IN ('created_by', 'customer_id')
  LOOP
    EXECUTE format('ALTER TABLE public.service_transactions DROP CONSTRAINT IF EXISTS %I', constraint_record.constraint_name);
  END LOOP;
END $$;

UPDATE service_transactions st
SET created_by = mapping.current_user_id
FROM legacy_creator_map mapping
WHERE st.created_by = mapping.legacy_user_id;

UPDATE service_transactions st
SET customer_id = mapping.current_user_id
FROM legacy_creator_map mapping
WHERE st.customer_id = mapping.legacy_user_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM service_transactions st
    LEFT JOIN users u ON u.id = st.created_by
    WHERE st.created_by IS NOT NULL
      AND u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Recovery stopped: one or more service creators could not be mapped into users.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM service_transactions st
    LEFT JOIN users u ON u.id = st.customer_id
    WHERE st.customer_id IS NOT NULL
      AND u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Recovery stopped: one or more service customers could not be mapped into users.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Appointment and historical-price fields.
-- Every legacy completed transaction is a walk-in unless an explicit source is
-- later known. Price snapshots use the matching saved service/role definitions
-- because the historical tables did not retain transaction-level prices.
-- ---------------------------------------------------------------------------
ALTER TABLE service_transactions
  ADD COLUMN IF NOT EXISTS service_source VARCHAR(30),
  ADD COLUMN IF NOT EXISTS original_service_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charged_service_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_salon_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS charged_salon_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backdate_reason TEXT;

ALTER TABLE service_performers
  ADD COLUMN IF NOT EXISTS preferred_employee_id INTEGER,
  ADD COLUMN IF NOT EXISTS earned_amount_snapshot INTEGER NOT NULL DEFAULT 0;

UPDATE service_transactions
SET service_source = COALESCE(service_source, 'walk_in')
WHERE service_source IS NULL;

UPDATE service_transactions st
SET
  original_service_amount = COALESCE(NULLIF(st.original_service_amount, 0), sd.service_amount, 0),
  charged_service_amount = COALESCE(NULLIF(st.charged_service_amount, 0), sd.service_amount, 0),
  original_salon_amount = COALESCE(NULLIF(st.original_salon_amount, 0), sd.salon_amount, 0),
  charged_salon_amount = COALESCE(NULLIF(st.charged_salon_amount, 0), sd.salon_amount, 0),
  discount_amount = COALESCE(st.discount_amount, 0)
FROM service_definitions sd
WHERE sd.id = st.service_definition_id;

UPDATE service_performers sp
SET earned_amount_snapshot = COALESCE(NULLIF(sp.earned_amount_snapshot, 0), sr.earned_amount, 0)
FROM service_roles sr
WHERE sr.id = sp.service_role_id;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_transactions_service_source_check') THEN
    ALTER TABLE service_transactions
      ADD CONSTRAINT service_transactions_service_source_check
      CHECK (service_source IS NULL OR service_source IN ('walk_in', 'online_booking'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Historical finance records. Business time comes from the original creation
-- timestamp in Kampala time; created_at remains the original audit timestamp.
-- ---------------------------------------------------------------------------
ALTER TABLE advances
  ADD COLUMN IF NOT EXISTS entry_type VARCHAR(20) NOT NULL DEFAULT 'current',
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_entry_type_check') THEN
    ALTER TABLE expenses ADD CONSTRAINT expenses_entry_type_check CHECK (entry_type IN ('current', 'past'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tag_fee_entry_type_check') THEN
    ALTER TABLE tag_fee ADD CONSTRAINT tag_fee_entry_type_check CHECK (entry_type IN ('current', 'past'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'late_fees_entry_type_check') THEN
    ALTER TABLE late_fees ADD CONSTRAINT late_fees_entry_type_check CHECK (entry_type IN ('current', 'past'));
  END IF;
END $$;

-- Employee profile and National ID evidence fields.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS id_document_front_url TEXT,
  ADD COLUMN IF NOT EXISTS id_document_back_url TEXT,
  ADD COLUMN IF NOT EXISTS id_document_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS national_id_number TEXT;

-- Replace legacy service-transaction identity foreign keys only after remapping.
DO $$
DECLARE constraint_record RECORD;
BEGIN
  FOR constraint_record IN
    SELECT DISTINCT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.constraint_schema = tc.constraint_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'service_transactions'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name IN ('created_by', 'customer_id')
  LOOP
    EXECUTE format('ALTER TABLE public.service_transactions DROP CONSTRAINT IF EXISTS %I', constraint_record.constraint_name);
  END LOOP;
END $$;

ALTER TABLE service_transactions
  ADD CONSTRAINT service_transactions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT service_transactions_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE service_performers
  ADD CONSTRAINT service_performers_preferred_employee_id_fkey
    FOREIGN KEY (preferred_employee_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_service_transactions_appointment_slot
  ON service_transactions (salon_id, appointment_date, appointment_time, status);

CREATE INDEX IF NOT EXISTS idx_service_performers_employee_booking
  ON service_performers (employee_id, preferred_employee_id, service_transaction_id);

COMMIT;
