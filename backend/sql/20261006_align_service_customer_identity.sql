-- One-time correction for the legacy service_transactions.customer_id relation.
-- The application joins customers through users, not usermain.
-- This preserves legacy account details by copying any missing usermain records
-- into users, then remaps only customer IDs that are invalid in users.

BEGIN;

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
  SELECT 1 FROM users u
  WHERE lower(trim(u.email)) = lower(trim(um.email))
);

CREATE TEMP TABLE legacy_customer_map ON COMMIT DROP AS
SELECT um.id AS legacy_user_id, u.id AS current_user_id
FROM usermain um
JOIN users u
  ON lower(trim(u.email)) = lower(trim(um.email));

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
      AND kcu.column_name = 'customer_id'
  LOOP
    EXECUTE format('ALTER TABLE public.service_transactions DROP CONSTRAINT IF EXISTS %I', constraint_record.constraint_name);
  END LOOP;
END $$;

UPDATE service_transactions st
SET customer_id = mapping.current_user_id
FROM legacy_customer_map mapping
WHERE st.customer_id = mapping.legacy_user_id
  AND NOT EXISTS (
    SELECT 1 FROM users existing_customer
    WHERE existing_customer.id = st.customer_id
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM service_transactions st
    LEFT JOIN users u ON u.id = st.customer_id
    WHERE st.customer_id IS NOT NULL
      AND u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Customer recovery stopped: a service customer could not be mapped into users.';
  END IF;
END $$;

ALTER TABLE service_transactions
  ADD CONSTRAINT service_transactions_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL;

COMMIT;
