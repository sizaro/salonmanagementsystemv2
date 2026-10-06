-- Follow-up to the already-applied employee-evidence upgrade.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS national_id_number TEXT;
