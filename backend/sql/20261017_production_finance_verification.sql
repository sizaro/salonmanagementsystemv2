-- Post-upgrade verification for the Salehish production Employee Finance alignment.
-- Read-only. Run after 20261017_production_finance_alignment.sql commits.

SELECT 'required_tables' AS check_name,
       jsonb_agg(jsonb_build_object('table', name, 'exists', to_regclass('public.' || name) IS NOT NULL) ORDER BY name) AS result
FROM (VALUES
  ('employee_activity_log'), ('employee_advance_requests'), ('employee_advance_settlements'),
  ('employee_earnings'), ('employee_finance_periods'), ('employee_finance_receipts'),
  ('employee_finance_receipt_signatures'), ('employee_payments'), ('owner_business_goals'), ('salon_campaigns')
) AS expected(name);

SELECT 'legacy_advance_coverage' AS check_name,
       a.salon_id,
       COUNT(*) AS legacy_advances,
       COUNT(ar.id) AS linked_finance_requests,
       COUNT(*) FILTER (WHERE ar.workflow_status = 'DISBURSED') AS disbursed_only_requests,
       COUNT(*) FILTER (WHERE ar.acknowledged_at IS NOT NULL OR ar.acknowledged_by IS NOT NULL) AS incorrectly_acknowledged,
       COALESCE(SUM(a.amount), 0) AS legacy_amount,
       COALESCE(SUM(ar.requested_amount), 0) AS linked_amount
FROM advances a
LEFT JOIN employee_advance_requests ar ON ar.salon_id = a.salon_id AND ar.advance_id = a.id
GROUP BY a.salon_id
ORDER BY a.salon_id;

SELECT 'earnings_backfill' AS check_name,
       expected.salon_id,
       expected.eligible_performer_rows,
       actual.earning_rows,
       expected.eligible_earnings_amount,
       actual.earnings_amount
FROM (
  SELECT sp.salon_id, COUNT(*) AS eligible_performer_rows, COALESCE(SUM(sp.earned_amount_snapshot), 0) AS eligible_earnings_amount
  FROM service_performers sp
  JOIN service_transactions st ON st.id = sp.service_transaction_id AND st.salon_id = sp.salon_id
  WHERE COALESCE(sp.employee_id, sp.preferred_employee_id) IS NOT NULL
    AND COALESCE(sp.earned_amount_snapshot, 0) > 0
    AND st.service_date IS NOT NULL AND st.service_time IS NOT NULL
    AND (st.status IS NULL OR LOWER(TRIM(st.status)) = 'completed')
  GROUP BY sp.salon_id
) expected
LEFT JOIN (
  SELECT salon_id, COUNT(*) AS earning_rows, COALESCE(SUM(amount), 0) AS earnings_amount
  FROM employee_earnings GROUP BY salon_id
) actual ON actual.salon_id = expected.salon_id
ORDER BY expected.salon_id;

SELECT 'unsafe_payroll_deductions' AS check_name,
       id, salon_id, employee_id, advance_request_id, amount, workflow_status,
       employee_consented_by, employee_consented_at
FROM employee_advance_settlements
WHERE settlement_method = 'PAYROLL_DEDUCTION'
  AND workflow_status = 'EFFECTIVE'
  AND (employee_consented_by IS NULL OR employee_consented_at IS NULL);

SELECT 'employee_balances' AS check_name,
       u.id AS employee_id,
       CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
       COALESCE(earnings.earned_amount, 0) AS earned_amount,
       COALESCE(payments.paid_amount, 0) AS paid_amount,
       COALESCE(deductions.payroll_deductions, 0) AS effective_payroll_deductions,
       GREATEST(COALESCE(earnings.earned_amount, 0) - COALESCE(payments.paid_amount, 0) - COALESCE(deductions.payroll_deductions, 0), 0) AS unpaid_amount,
       GREATEST(COALESCE(advances.disbursed_amount, 0) - COALESCE(settlements.settled_amount, 0), 0) AS advances_outstanding
FROM users u
LEFT JOIN LATERAL (SELECT SUM(amount) AS earned_amount FROM employee_earnings WHERE salon_id = u.salon_id AND employee_id = u.id) earnings ON TRUE
LEFT JOIN LATERAL (SELECT SUM(requested_amount) AS paid_amount FROM employee_payments WHERE salon_id = u.salon_id AND employee_id = u.id AND workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')) payments ON TRUE
LEFT JOIN LATERAL (SELECT SUM(amount) AS payroll_deductions FROM employee_advance_settlements WHERE salon_id = u.salon_id AND employee_id = u.id AND settlement_method = 'PAYROLL_DEDUCTION' AND workflow_status = 'EFFECTIVE') deductions ON TRUE
LEFT JOIN LATERAL (SELECT SUM(requested_amount) AS disbursed_amount FROM employee_advance_requests WHERE salon_id = u.salon_id AND employee_id = u.id AND workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')) advances ON TRUE
LEFT JOIN LATERAL (SELECT SUM(amount) AS settled_amount FROM employee_advance_settlements WHERE salon_id = u.salon_id AND employee_id = u.id AND workflow_status = 'EFFECTIVE') settlements ON TRUE
WHERE LOWER(COALESCE(u.role, '')) IN ('employee', 'manager', 'cashier')
ORDER BY u.first_name, u.last_name, u.id;
