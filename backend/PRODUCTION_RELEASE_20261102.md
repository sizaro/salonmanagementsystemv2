# Production release runbook — 2 November 2026

This runbook is for the supplied production backup and the current release.
It does not execute payment-provider traffic. Cash at Counter is the only
method exposed for new entries in this release; existing external-payment code
and historical records are preserved.

## Verified production starting point

- 25 legacy `advances` rows totalling UGX 107,500.
- 402 existing employee-earnings rows totalling UGX 635,500 before alignment.
- The finance-alignment rehearsal imports the missing source-linked history,
  resulting in 25 linked legacy advance requests and 410 source-linked earnings.
- Of the legacy advances, 22 staff advances total UGX 104,500 and are included
  in the employee-finance historical snapshot. Three owner advances total UGX
  3,000; they remain unchanged because an owner is not an employee-finance
  recipient and must not be represented as employee salary deductions.
- The supplied database has no `payment_intents`, payment ledger, bank-credit,
  audit-event, appointment-event, or finance-cutover tables.

## Important cutover rule

Do **not** run `sql/20261021_employee_finance_cutover.sql` for this release.
Its 9 October 2026 fixed date would leave later legacy earnings and an advance
outside the historical close. Run the replacement
`sql/20261102_production_legacy_finance_cutover.sql` instead.

The replacement derives the boundary from the target data's latest legacy
earning or advance. It snapshots historical amounts only. It does not invent
receipts, signatures, approvals, acknowledgements, or individual settlements.

## pgAdmin execution order

1. Take and retain a fresh production backup. Confirm the selected database is
   the intended production database.
2. Run `20261017_employee_cloudinary_asset_identifiers.sql`.
3. Run `20261017_production_finance_alignment.sql`.
4. Run `20261019_historical_employee_finance_entries.sql`.
5. Run `20261020_service_collection_methods.sql`.
6. Run `20261102_production_legacy_finance_cutover.sql`.
7. Run `20261022_advance_settlement_attestation.sql`.
8. Run, in order:
   - `20261026_payment_engine_foundation.sql`
   - `20261026_payment_engine_bank_and_ledger.sql`
   - `20261026_payment_engine_resilience.sql`
   - `20261027_appointment_production_hardening.sql`
   - `20261027_manual_bank_payout_controls.sql`
   - `20261029_financial_audit_foundation.sql`
9. Run `20261029_financial_appointment_post_deployment_verification.sql`.
10. Run `20261021_employee_finance_cutover_verify.sql`, changing nothing if a
    check needs review. Send its result for investigation.

## Deployment holds

Do not deploy until the migration verification passes and the frontend's
existing uncommitted changes have been reviewed and committed deliberately.
Do not start a local backend process while its development environment points
at a remote database.
