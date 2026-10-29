# Production financial and appointment database release

This folder is the source of truth for PostgreSQL changes. Production changes
are deliberately **manual**: an authorized technical operator runs the listed
SQL files in pgAdmin 4. The backend must not apply production schema changes at
startup.

## Scope

This release adds the centralized payment engine, bank collections and payout
controls, the External Payments Ledger data model, and appointment-completion
hardening. Each listed migration is additive and is written with
`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` safeguards where PostgreSQL
supports them. It must still be recorded by the operator as applied; do not use
those safeguards as a substitute for change control.

## Before changing production

1. Confirm the target database and connected server in pgAdmin 4.
2. Confirm the existing application is healthy and no schema deployment is in
   progress.
3. Take or confirm that an operator-managed backup exists. This project does
   not create or manage backups.
4. Open a Query Tool against the production database. Do not run these files
   against a backup, template, or another salon's database by mistake.
5. Record the operator, timestamp, database name, application release, and
   result of every script in the deployment record.

## Required order for the centralized-payment release

Run each file individually. Stop immediately if any script reports an error;
do not continue with later scripts.

1. `20261020_service_collection_methods.sql` *(only if it has not already
   been applied in this database)*
2. `20261026_payment_engine_foundation.sql`
3. `20261026_payment_engine_bank_and_ledger.sql`
4. `20261026_payment_engine_resilience.sql`
5. `20261027_manual_bank_payout_controls.sql`
6. `appointment_flow_upgrade.sql` *(only if the original appointment upgrade
   is not already present)*
7. `20261027_appointment_production_hardening.sql`
8. `20261029_financial_appointment_post_deployment_verification.sql`
   *(read-only verification; always run this last)*

If this is a newly provisioned database, apply the earlier schema and employee
finance releases first, in their dated order. Do **not** run
`20261006_recover_backup_to_current_schema.sql` unless performing the specific
backup-recovery operation for which it was written.

## After the SQL succeeds

1. Run the verification SQL and save/export its result with the release record.
2. Every row labelled `REQUIRED` must be `PASS` before deploying/restarting the
   backend.
3. `OBSERVATION` rows describe operational work queues (for example unmatched
   bank credits). They are not schema failures and must be investigated through
   the authorized payment-reconciliation process.
4. Restart or redeploy the backend only after verification passes.
5. Verify `/health` and perform a non-financial smoke test. In a production
   payment environment, never use the mock-bank controls to post a real record.

## Development workflow

Development may continue to use the existing scripts in `backend/scripts/`,
including `yarn db:payment-engine-foundation` and
`yarn db:appointment-upgrade`. They load the same SQL files in the required
dependency order. Their use does not authorize automatic production migration.

## Rollback

These are additive financial-schema changes. Do not attempt a blanket rollback
by dropping payment tables, columns, or indexes after application traffic has
used them. If a release fails before the application is deployed, stop and
investigate the precise error. If a production rollback is required after data
has been written, use a reviewed, record-preserving corrective script and the
operator-managed recovery process.
