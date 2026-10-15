# Production schema upgrade: employee finance and supporting workspaces

This package aligns the deployed PostgreSQL schema with the finance, receipts, consent, employee activity, owner-goals, and campaigns features already present in the application code.

## Included migration sources

The combined upgrade runs these existing additive scripts in this exact order:

1. `20261008_employee_finance_foundation.sql`
2. `20261008_employee_finance_operations.sql`
3. `20261008_employee_advance_settlements.sql`
4. `20261009_employee_finance_signed_receipts.sql`
5. `20261012_employee_payroll_deduction_consent.sql`
6. `20261009_employee_profile_audit.sql`
7. `20261010_owner_intelligence.sql`

The combined file is `sql/20261015_production_schema_upgrade.sql`.

## Confirmed production preflight

The reviewed production database contains no tables from this package. It contains:

- 329 eligible completed service-performer records, totaling UGX 515,500, for 9 employees. These will be copied once into `employee_earnings`.
- 8 completed performer records without an assigned employee. They remain excluded.
- 6 completed performer records without a positive earning snapshot. They remain excluded.
- 20 legacy `advances` records totaling UGX 51,000. They remain unchanged in `advances`.

Legacy advances are intentionally not converted into `employee_advance_requests`, settlements, or payroll deductions. They do not carry the request, approval, disbursement, acknowledgement, repayment, waiver, or consent evidence required by the new workflow.

## Safe execution procedure

1. Run `sql/20261015_production_schema_preflight.sql` and retain its result.
2. Export or back up the Render PostgreSQL database.
3. Confirm the target connection identifies the intended production database.
4. Run `sql/20261015_production_schema_upgrade.sql` as one complete script.
5. If the SQL client reports an error, do not run fragments manually. The transaction rolls back as a unit; send the error for review.
6. Run `sql/20261015_production_schema_verification.sql`.
7. Confirm:
   - Every required table exists.
   - `expectedRows` equals `insertedRowsFromExpectedSources`.
   - `expectedAmount` equals `insertedAmountFromExpectedSources`.
   - `duplicateSourceReferences` is `0`.
   - Legacy advances remain `20` records totaling `51000`.
   - New workflow counts begin at `0` before users create new requests.
8. Deploy application code only after the verification results are correct.

## Payroll-deduction safety

No historic payroll deduction exists in production because `employee_advance_settlements` does not yet exist. Future payroll deductions are created as `PENDING_EMPLOYEE_CONSENT` and only become effective after the receiving employee signs consent for the exact settlement.

## Excluded scripts

Do not run these as part of this production upgrade:

- `20261005_historical_business_records_and_employee_id_evidence.sql`
- `20261006_align_service_customer_identity.sql`
- `20261006_recover_backup_to_current_schema.sql`

They address earlier structural or recovery paths and are not part of this confirmed production rollout.


