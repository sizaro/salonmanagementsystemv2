# Production Employee Finance Alignment

These SQL files align the Render production database with the local Employee Finance, signed-receipt, employee-audit, and owner-intelligence schema without deleting or rewriting legacy records.

## Run order

1. Create a Render database backup/export.
2. Run `20261017_production_finance_preflight.sql` and save the JSON result.
3. Confirm it reports no legacy advance row without a linked employee and that every salon containing legacy advances has an owner account.
4. Run `20261017_production_finance_alignment.sql` once. It is one transaction, so an error rolls back every change from that run.
5. Run `20261017_production_finance_verification.sql`.
6. Confirm every legacy advance is linked once, is `DISBURSED`, and has no acknowledgement. The unsafe-payroll-deductions query must return zero rows.
7. Deploy the matching code and test finance as Owner, Manager, Cashier, and Employee.

For the production preflight result already captured on 17 October 2026, the expected verification baseline is salon `1`: **20** legacy advances totaling **UGX 51,000**, and **329** eligible completed-service performer rows totaling **UGX 515,500**. Treat a different result as a reason to stop and investigate before deployment.

Run each file in a fresh Render query tab. The alignment file contains its own `BEGIN` and `COMMIT`; do not wrap it in another transaction or combine it with the preflight/verification files. If Render reports that the current transaction is aborted, run `ROLLBACK;` by itself, correct the reported issue, then begin again from the preflight file.

## Historical treatment

- Completed-service earnings are copied once from eligible service performer snapshots.
- Legacy advances are preserved in `advances` and receive one linked finance row marked `DISBURSED` only.
- No legacy advance receives a fabricated approval, employee acknowledgement, receipt, signature, repayment, waiver, or payroll-deduction consent.
- The required `requested_by` value on an imported legacy advance is technical migration attribution only. It is not evidence that the selected owner requested, approved, or disbursed that advance.
- A payroll deduction reduces a balance only after the employee’s signed consent produces an `EFFECTIVE` settlement.

Do not run the alignment script against a different database or with application traffic writing finance records at the same time. If it fails, copy the exact error before attempting another run.
