-- Read-only post-closeout verification. All values listed as outstanding,
-- pending, or remaining must be zero before treating 4 November 2026 as the
-- first clean controlled-workflow day.

WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date)
SELECT
  (SELECT COUNT(*) FROM employee_advance_requests ar
   WHERE ar.workflow_status = 'REQUESTED'
     AND COALESCE(ar.business_occurred_at, ar.created_at)::date <= (SELECT cutoff_date FROM settings)) AS requested_advances_not_cancelled,
  (SELECT COUNT(*) FROM employee_advance_requests ar
   WHERE ar.workflow_status = 'APPROVED'
     AND COALESCE(ar.business_occurred_at, ar.created_at)::date <= (SELECT cutoff_date FROM settings)) AS approved_advances_not_reconstructed,
  (SELECT COUNT(*) FROM employee_payments ep
   WHERE ep.workflow_status IN ('REQUESTED', 'APPROVED')
     AND COALESCE(ep.business_occurred_at, ep.created_at)::date <= (SELECT cutoff_date FROM settings)) AS unissued_employee_payments_not_cancelled,
  (SELECT COALESCE(SUM(GREATEST(ar.requested_amount - COALESCE((SELECT SUM(s.amount) FROM employee_advance_settlements s WHERE s.salon_id = ar.salon_id AND s.advance_request_id = ar.id AND s.workflow_status = 'EFFECTIVE'), 0), 0)), 0)
   FROM employee_advance_requests ar
   WHERE ar.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
     AND COALESCE(ar.disbursed_at, ar.business_occurred_at, ar.created_at)::date <= (SELECT cutoff_date FROM settings))::numeric(14,2) AS outstanding_disbursed_advances,
  (SELECT COUNT(*) FROM employee_fee_obligations o
   WHERE o.workflow_status IN ('OPEN', 'SETTLEMENT_PENDING') AND o.fee_date <= (SELECT cutoff_date FROM settings)) AS open_fee_obligations,
  (SELECT COALESCE(SUM(GREATEST(o.amount - COALESCE((SELECT SUM(s.amount) FROM employee_fee_settlements s WHERE s.salon_id = o.salon_id AND s.fee_obligation_id = o.id AND s.workflow_status = 'EFFECTIVE'), 0), 0)), 0)
   FROM employee_fee_obligations o
   WHERE o.fee_date <= (SELECT cutoff_date FROM settings))::numeric(14,2) AS outstanding_fee_amount,
  (SELECT COUNT(*) FROM employee_finance_closeouts WHERE cutoff_date = (SELECT cutoff_date FROM settings)) AS closeout_headers;

WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date), staff AS (
  SELECT id AS employee_id, salon_id FROM users
  WHERE LOWER(COALESCE(role, '')) IN ('employee', 'manager', 'cashier')
), balances AS (
  SELECT staff.salon_id, staff.employee_id,
    GREATEST(
      COALESCE((SELECT SUM(ee.amount) FROM employee_earnings ee WHERE ee.salon_id=staff.salon_id AND ee.employee_id=staff.employee_id AND ee.earning_date <= (SELECT cutoff_date FROM settings) AND NOT EXISTS (SELECT 1 FROM employee_finance_cutovers c WHERE c.salon_id=ee.salon_id AND ee.earning_date <= c.legacy_ends_on)),0)
      - COALESCE((SELECT SUM(ep.requested_amount) FROM employee_payments ep WHERE ep.salon_id=staff.salon_id AND ep.employee_id=staff.employee_id AND ep.workflow_status IN ('DISBURSED','ACKNOWLEDGED') AND COALESCE(ep.business_occurred_at,ep.disbursed_at,ep.created_at)::date <= (SELECT cutoff_date FROM settings)),0)
      - COALESCE((SELECT SUM(s.amount) FROM employee_advance_settlements s JOIN employee_advance_requests ar ON ar.id=s.advance_request_id AND ar.salon_id=s.salon_id LEFT JOIN advances legacy_source ON legacy_source.id=ar.advance_id AND legacy_source.salon_id=ar.salon_id LEFT JOIN employee_finance_cutovers c ON c.salon_id=ar.salon_id WHERE s.salon_id=staff.salon_id AND s.employee_id=staff.employee_id AND s.workflow_status='EFFECTIVE' AND s.settlement_method='PAYROLL_DEDUCTION' AND s.settled_at::date <= (SELECT cutoff_date FROM settings) AND NOT (legacy_source.id IS NOT NULL AND c.salon_id IS NOT NULL AND legacy_source.advance_date <= c.legacy_ends_on AND ar.reason LIKE 'Historical legacy advance #%')),0)
      - COALESCE((SELECT SUM(s.amount) FROM employee_fee_settlements s WHERE s.salon_id=staff.salon_id AND s.employee_id=staff.employee_id AND s.workflow_status='EFFECTIVE' AND s.settlement_method='PAYROLL_DEDUCTION' AND s.settled_at::date <= (SELECT cutoff_date FROM settings)),0),
      0
    )::numeric AS remaining_amount
  FROM staff
)
SELECT COALESCE(SUM(remaining_amount),0)::numeric(14,2) AS remaining_employee_earnings_to_resolve
FROM balances;
