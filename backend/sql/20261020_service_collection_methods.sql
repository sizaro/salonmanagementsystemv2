-- Customer collection channels for completed salon services.
-- Safe for existing salons: historical service transactions are classified as CASH,
-- which is how the existing counter workflow has recorded them.

BEGIN;

ALTER TABLE service_transactions
  ADD COLUMN IF NOT EXISTS collection_method VARCHAR(20) NOT NULL DEFAULT 'CASH',
  ADD COLUMN IF NOT EXISTS collection_reference TEXT;

UPDATE service_transactions
SET collection_method = 'CASH'
WHERE collection_method IS NULL
   OR BTRIM(collection_method) = '';

ALTER TABLE service_transactions
  ALTER COLUMN collection_method SET DEFAULT 'CASH',
  ALTER COLUMN collection_method SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'service_transactions_collection_method_check'
      AND conrelid = 'service_transactions'::regclass
  ) THEN
    ALTER TABLE service_transactions
      ADD CONSTRAINT service_transactions_collection_method_check
      CHECK (collection_method IN (
        'CASH',
        'MTN_MOMO',
        'AIRTEL_MONEY',
        'BANK_TRANSFER',
        'OTHER'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_service_transactions_salon_collection_method_date
  ON service_transactions (salon_id, collection_method, service_date);

COMMIT;
