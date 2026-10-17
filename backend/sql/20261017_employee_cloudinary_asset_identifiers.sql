-- Cloudinary asset identity for safe employee-file replacement and removal.
-- Additive only: existing employee records and stored URLs remain unchanged.

BEGIN;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS image_public_id TEXT,
  ADD COLUMN IF NOT EXISTS id_document_front_public_id TEXT,
  ADD COLUMN IF NOT EXISTS id_document_back_public_id TEXT,
  ADD COLUMN IF NOT EXISTS id_document_pdf_public_id TEXT;

COMMENT ON COLUMN public.users.image_public_id IS
  'Cloudinary public_id for the employee profile image; used for safe replacement and deletion.';
COMMENT ON COLUMN public.users.id_document_front_public_id IS
  'Cloudinary public_id for the employee National ID front image; used for safe replacement and deletion.';
COMMENT ON COLUMN public.users.id_document_back_public_id IS
  'Cloudinary public_id for the employee National ID back image; used for safe replacement and deletion.';
COMMENT ON COLUMN public.users.id_document_pdf_public_id IS
  'Cloudinary public_id for the employee National ID PDF; used for safe replacement and deletion.';

COMMIT;
