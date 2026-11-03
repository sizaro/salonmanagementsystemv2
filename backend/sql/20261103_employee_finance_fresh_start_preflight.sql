-- Read-only preflight for the one-time employee-finance closeout.
-- Scope: everything with a business date on or before 3 November 2026.
-- The following day starts the controlled workflow with no carried balance.

WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date),
advance_balances AS (
  SELECT ar.id, ar.salon_id, ar.employee_id, ar.workflow_status, ar.requested_amount,
         COALESCE(ar.disbursed_at, ar.business_occurred_at, ar.created_at) AS occurred_at,
         GREATEST(ar.requested_amount - COALESCE((
           SELECT SUM(s.amount) FROM employee_advance_settlements s
           WHERE s.salon_id = ar.salon_id AND s.advance_request_id = ar.id
             AND s.workflow_status = 'EFFECTIVE'
         ), 0), 0)::numeric AS outstanding_amount
  FROM employee_advance_requests ar
), fee_balances AS (
  SELECT o.id, o.salon_id, o.employee_id, o.fee_type, o.workflow_status, o.amount, o.fee_date,
         GREATEST(o.amount - COALESCE((
           SELECT SUM(s.amount) FROM employee_fee_settlements s
           WHERE s.salon_id = o.salon_id AND s.fee_obligation_id = o.id
             AND s.workflow_status = 'EFFECTIVE'
         ), 0), 0)::numeric AS outstanding_amount
  FROM employee_fee_obligations o
)
SELECT
  'ADVANCES' AS category,
  workflow_status AS status,
  COUNT(*) AS records,
  COALESCE(SUM(requested_amount), 0)::numeric(14,2) AS recorded_amount,
  COALESCE(SUM(outstanding_amount), 0)::numeric(14,2) AS amount_to_close_or_cancel,
  CASE
    WHEN workflow_status = 'REQUESTED' THEN 'Will be cancelled as unissued'
    WHEN workflow_status = 'APPROVED' THEN 'Will be reconstructed as a historical disbursement and salary deduction'
    WHEN workflow_status IN ('DISBURSED', 'ACKNOWLEDGED') THEN 'Will be settled by historical salary deduction'
    ELSE 'Preserved as existing historical status'
  END AS closeout_action
FROM advance_balances, settings
WHERE occurred_at::date <= settings.cutoff_date
GROUP BY workflow_status
ORDER BY workflow_status;

WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date), fee_balances AS (
  SELECT o.id, o.salon_id, o.employee_id, o.fee_type, o.workflow_status, o.amount, o.fee_date,
         GREATEST(o.amount - COALESCE((
           SELECT SUM(s.amount) FROM employee_fee_settlements s
           WHERE s.salon_id = o.salon_id AND s.fee_obligation_id = o.id
             AND s.workflow_status = 'EFFECTIVE'
         ), 0), 0)::numeric AS outstanding_amount
  FROM employee_fee_obligations o
)
SELECT
  'FEES' AS category,
  fee_type,
  workflow_status AS status,
  COUNT(*) AS records,
  COALESCE(SUM(outstanding_amount), 0)::numeric(14,2) AS amount_to_close
FROM fee_balances, settings
WHERE fee_date <= settings.cutoff_date
  AND workflow_status IN ('OPEN', 'SETTLEMENT_PENDING')
GROUP BY fee_type, workflow_status
ORDER BY fee_type, workflow_status;

WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date)
SELECT
  'EMPLOYEE_PAYMENTS' AS category,
  ep.workflow_status AS status,
  COUNT(*) AS records,
  COALESCE(SUM(ep.requested_amount), 0)::numeric(14,2) AS recorded_amount,
  CASE WHEN ep.workflow_status IN ('REQUESTED', 'APPROVED')
       THEN 'Will be cancelled as unissued' ELSE 'Already disbursed history' END AS closeout_action
FROM employee_payments ep, settings
WHERE COALESCE(ep.business_occurred_at, ep.disbursed_at, ep.created_at)::date <= settings.cutoff_date
GROUP BY ep.workflow_status
ORDER BY ep.workflow_status;

WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date), staff AS (
  SELECT id AS employee_id, salon_id, CONCAT(first_name, ' ', last_name) AS employee_name
  FROM users
  WHERE LOWER(COALESCE(role, '')) IN ('employee', 'manager', 'cashier')
), earnings AS (
  SELECT ee.salon_id, ee.employee_id, COALESCE(SUM(ee.amount), 0)::numeric AS amount
  FROM employee_earnings ee, settings
  WHERE ee.earning_date <= settings.cutoff_date
    AND NOT EXISTS (
      SELECT 1 FROM employee_finance_cutovers c
      WHERE c.salon_id = ee.salon_id AND ee.earning_date <= c.legacy_ends_on
    )
  GROUP BY ee.salon_id, ee.employee_id
), paid AS (
  SELECT ep.salon_id, ep.employee_id, COALESCE(SUM(ep.requested_amount), 0)::numeric AS amount
  FROM employee_payments ep, settings
  WHERE ep.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
    AND COALESCE(ep.business_occurred_at, ep.disbursed_at, ep.created_at)::date <= settings.cutoff_date
  GROUP BY ep.salon_id, ep.employee_id
), advance_deductions AS (
  SELECT s.salon_id, s.employee_id, COALESCE(SUM(s.amount), 0)::numeric AS amount
  FROM employee_advance_settlements s
  JOIN employee_advance_requests ar ON ar.id = s.advance_request_id AND ar.salon_id = s.salon_id
  LEFT JOIN advances legacy_source ON legacy_source.id = ar.advance_id AND legacy_source.salon_id = ar.salon_id
  LEFT JOIN employee_finance_cutovers c ON c.salon_id = ar.salon_id
  CROSS JOIN settings
  WHERE s.workflow_status = 'EFFECTIVE'
    AND s.settlement_method = 'PAYROLL_DEDUCTION'
    AND s.settled_at::date <= settings.cutoff_date
    AND NOT (
      legacy_source.id IS NOT NULL AND c.salon_id IS NOT NULL
      AND legacy_source.advance_date <= c.legacy_ends_on
      AND ar.reason LIKE 'Historical legacy advance #%'
    )
  GROUP BY s.salon_id, s.employee_id
), fee_deductions AS (
  SELECT s.salon_id, s.employee_id, COALESCE(SUM(s.amount), 0)::numeric AS amount
  FROM employee_fee_settlements s, settings
  WHERE s.workflow_status = 'EFFECTIVE' AND s.settlement_method = 'PAYROLL_DEDUCTION'
    AND s.settled_at::date <= settings.cutoff_date
  GROUP BY s.salon_id, s.employee_id
)
SELECT
  staff.employee_id,
  staff.employee_name,
  COALESCE(earnings.amount, 0)::numeric(14,2) AS earnings_to_close,
  COALESCE(paid.amount, 0)::numeric(14,2) AS payments_already_recorded,
  COALESCE(advance_deductions.amount, 0)::numeric(14,2) AS advance_deductions,
  COALESCE(fee_deductions.amount, 0)::numeric(14,2) AS fee_deductions,
  GREATEST(COALESCE(earnings.amount, 0) - COALESCE(paid.amount, 0) - COALESCE(advance_deductions.amount, 0) - COALESCE(fee_deductions.amount, 0), 0)::numeric(14,2) AS remaining_salary_to_resolve
FROM staff
LEFT JOIN earnings ON earnings.salon_id = staff.salon_id AND earnings.employee_id = staff.employee_id
LEFT JOIN paid ON paid.salon_id = staff.salon_id AND paid.employee_id = staff.employee_id
LEFT JOIN advance_deductions ON advance_deductions.salon_id = staff.salon_id AND advance_deductions.employee_id = staff.employee_id
LEFT JOIN fee_deductions ON fee_deductions.salon_id = staff.salon_id AND fee_deductions.employee_id = staff.employee_id
WHERE COALESCE(earnings.amount, 0) > 0 OR COALESCE(paid.amount, 0) > 0 OR COALESCE(advance_deductions.amount, 0) > 0 OR COALESCE(fee_deductions.amount, 0) > 0
ORDER BY staff.employee_name;
