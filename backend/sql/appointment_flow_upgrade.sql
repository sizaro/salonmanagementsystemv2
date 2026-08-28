BEGIN;

ALTER TABLE service_transactions
  ADD COLUMN IF NOT EXISTS original_service_amount INTEGER,
  ADD COLUMN IF NOT EXISTS charged_service_amount INTEGER,
  ADD COLUMN IF NOT EXISTS discount_amount INTEGER,
  ADD COLUMN IF NOT EXISTS original_salon_amount INTEGER,
  ADD COLUMN IF NOT EXISTS charged_salon_amount INTEGER;

ALTER TABLE service_performers
  ADD COLUMN IF NOT EXISTS earned_amount_snapshot INTEGER;

UPDATE service_transactions st
SET
  original_service_amount = COALESCE(st.original_service_amount, sd.service_amount, 0),
  charged_service_amount = COALESCE(st.charged_service_amount, CASE WHEN LOWER(COALESCE(st.service_source, '')) = 'online_booking' THEN GREATEST(COALESCE(sd.service_amount, 0) - 500, 0) ELSE COALESCE(sd.service_amount, 0) END),
  discount_amount = COALESCE(st.discount_amount, CASE WHEN LOWER(COALESCE(st.service_source, '')) = 'online_booking' THEN 500 ELSE 0 END),
  original_salon_amount = COALESCE(st.original_salon_amount, sd.salon_amount, 0),
  charged_salon_amount = COALESCE(st.charged_salon_amount, CASE WHEN LOWER(COALESCE(st.service_source, '')) = 'online_booking' THEN GREATEST(COALESCE(sd.salon_amount, 0) - 500, 0) ELSE COALESCE(sd.salon_amount, 0) END)
FROM service_definitions sd
WHERE sd.id = st.service_definition_id;

UPDATE service_performers sp
SET earned_amount_snapshot = COALESCE(sp.earned_amount_snapshot, sr.earned_amount, 0)
FROM service_roles sr
WHERE sr.id = sp.service_role_id;

UPDATE service_transactions SET
  original_service_amount = COALESCE(original_service_amount, 0),
  charged_service_amount = COALESCE(charged_service_amount, 0),
  discount_amount = COALESCE(discount_amount, 0),
  original_salon_amount = COALESCE(original_salon_amount, 0),
  charged_salon_amount = COALESCE(charged_salon_amount, 0);

UPDATE service_performers
SET earned_amount_snapshot = COALESCE(earned_amount_snapshot, 0);

ALTER TABLE service_transactions
  ALTER COLUMN original_service_amount SET NOT NULL,
  ALTER COLUMN charged_service_amount SET NOT NULL,
  ALTER COLUMN discount_amount SET NOT NULL,
  ALTER COLUMN original_salon_amount SET NOT NULL,
  ALTER COLUMN charged_salon_amount SET NOT NULL;

ALTER TABLE service_performers
  ALTER COLUMN earned_amount_snapshot SET NOT NULL;

DO $block$
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
END
$block$;

ALTER TABLE service_transactions
  ADD CONSTRAINT service_transactions_created_by_users_fkey
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT service_transactions_customer_id_users_fkey
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL NOT VALID;

CREATE INDEX IF NOT EXISTS idx_service_transactions_appointment_slot
  ON service_transactions (salon_id, appointment_date, appointment_time, status);

CREATE INDEX IF NOT EXISTS idx_service_performers_employee_booking
  ON service_performers (employee_id, preferred_employee_id, service_transaction_id);

COMMIT;
