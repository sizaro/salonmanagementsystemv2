-- Read-only production verification for the centralized payment and appointment release.
-- Run this in pgAdmin 4 after the ordered files in
-- PRODUCTION_FINANCIAL_APPOINTMENT_RELEASE.md. It performs no DDL and no DML.

WITH required_checks AS (
  SELECT 'REQUIRED'::text AS severity, 'payment_intents table'::text AS check_name,
         to_regclass('public.payment_intents') IS NOT NULL AS passed,
         'Central payment intents are available.'::text AS detail
  UNION ALL SELECT 'REQUIRED', 'payment_attempts table',
         to_regclass('public.payment_attempts') IS NOT NULL,
         'Provider attempt history is available.'
  UNION ALL SELECT 'REQUIRED', 'payment_provider_events table',
         to_regclass('public.payment_provider_events') IS NOT NULL,
         'Provider event deduplication evidence is available.'
  UNION ALL SELECT 'REQUIRED', 'payment_allocations table',
         to_regclass('public.payment_allocations') IS NOT NULL,
         'A verified payment can be allocated to one originating record.'
  UNION ALL SELECT 'REQUIRED', 'payment audit table',
         to_regclass('public.payment_audit_logs') IS NOT NULL,
         'Payment workflow audit evidence is available.'
  UNION ALL SELECT 'REQUIRED', 'salon bank accounts table',
         to_regclass('public.salon_bank_accounts') IS NOT NULL,
         'Official receiving accounts can be configured per salon.'
  UNION ALL SELECT 'REQUIRED', 'bank incoming credits table',
         to_regclass('public.bank_incoming_credits') IS NOT NULL,
         'Incoming bank credits can be reconciled without guessing.'
  UNION ALL SELECT 'REQUIRED', 'payment recovery retry column',
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'payment_intents'
             AND column_name = 'next_finalization_attempt_at'
         ),
         'Confirmed payment posting recovery can be scheduled.'
  UNION ALL SELECT 'REQUIRED', 'payment verification status column',
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'payment_intents'
             AND column_name = 'verification_status'
         ),
         'Ledger verification state is available.'
  UNION ALL SELECT 'REQUIRED', 'bank reference uniqueness index',
         to_regclass('public.payment_intents_bank_payment_reference_unique') IS NOT NULL,
         'A bank reference cannot be reused within a salon.'
  UNION ALL SELECT 'REQUIRED', 'bank transaction deduplication constraint',
         EXISTS (
           SELECT 1 FROM pg_constraint
           WHERE conrelid = to_regclass('public.bank_incoming_credits')
             AND conname = 'bank_incoming_credits_transaction_unique'
         ),
         'A bank transaction ID cannot be stored twice for the same provider.'
  UNION ALL SELECT 'REQUIRED', 'one bank credit per intent index',
         to_regclass('public.bank_incoming_credits_one_intent_unique') IS NOT NULL,
         'One bank credit cannot pay more than one payment intent.'
  UNION ALL SELECT 'REQUIRED', 'service external payment link',
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'service_transactions'
             AND column_name = 'external_payment_intent_id'
         ),
         'Posted service transactions can be linked to the verified intent.'
  UNION ALL SELECT 'REQUIRED', 'expense external payment link',
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'expenses'
             AND column_name = 'external_payment_intent_id'
         ),
         'External expense disbursements can be linked to their intent.'
  UNION ALL SELECT 'REQUIRED', 'employee advance external payment link',
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'employee_advance_requests'
             AND column_name = 'external_payment_intent_id'
         ),
         'External advance disbursements can be linked to their intent.'
  UNION ALL SELECT 'REQUIRED', 'employee payment external payment link',
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'employee_payments'
             AND column_name = 'external_payment_intent_id'
         ),
         'External employee payments can be linked to their intent.'
  UNION ALL SELECT 'REQUIRED', 'advance repayment external payment link',
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'employee_advance_settlements'
             AND column_name = 'external_payment_intent_id'
         ),
         'External advance repayments can be linked to their intent.'
  UNION ALL SELECT 'REQUIRED', 'salon timezone column',
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'salons' AND column_name = 'timezone'
         ),
         'Ledger reporting can use the salon timezone.'
  UNION ALL SELECT 'REQUIRED', 'appointment settings table',
         to_regclass('public.salon_appointment_settings') IS NOT NULL,
         'Appointment availability configuration is available.'
  UNION ALL SELECT 'REQUIRED', 'appointment events table',
         to_regclass('public.appointment_events') IS NOT NULL,
         'Appointment lifecycle history is available.'
  UNION ALL SELECT 'REQUIRED', 'appointment completion idempotency index',
         to_regclass('public.service_transactions_customer_booking_idempotency_unique') IS NOT NULL,
         'One appointment completion cannot create duplicate service records.'
),
operational_observations AS (
  SELECT 'OBSERVATION'::text AS severity,
         'confirmed payments awaiting posting'::text AS check_name,
         NOT EXISTS (
           SELECT 1 FROM payment_intents
           WHERE payment_status = 'CONFIRMED' AND posting_status <> 'POSTED'
         ) AS passed,
         'False means recovery must be reviewed; do not create another payment.'::text AS detail
  UNION ALL SELECT 'OBSERVATION', 'unmatched bank credits',
         NOT EXISTS (
           SELECT 1 FROM bank_incoming_credits
           WHERE match_status IN ('UNMATCHED', 'INVESTIGATING')
         ),
         'False means credits need authorized reconciliation; never match by amount alone.'
  UNION ALL SELECT 'OBSERVATION', 'bank payouts awaiting manual verification',
         NOT EXISTS (
           SELECT 1 FROM payment_intents
           WHERE provider = 'BANK_TRANSFER' AND direction = 'DISBURSEMENT'
             AND manual_execution_status IN ('AWAITING_EXECUTION', 'SUBMITTED')
         ),
         'False means an authorized operator must obtain execution evidence before posting.'
),
all_checks AS (
  SELECT severity,
         check_name,
         CASE WHEN passed THEN 'PASS' ELSE 'REVIEW' END AS result,
         detail
  FROM required_checks
  UNION ALL
  SELECT severity,
         check_name,
         CASE WHEN passed THEN 'CLEAR' ELSE 'ACTION REQUIRED' END AS result,
         detail
  FROM operational_observations
)
SELECT severity,
       check_name,
       result,
       detail
FROM all_checks
ORDER BY CASE severity WHEN 'REQUIRED' THEN 1 ELSE 2 END, check_name;
