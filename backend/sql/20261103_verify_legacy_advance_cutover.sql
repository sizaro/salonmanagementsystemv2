-- Read-only verification for the historical advance closure.
-- Run before and after 20261103_close_legacy_advance_auto_deductions.sql.

WITH legacy_advances AS (
  SELECT
    ar.id AS advance_request_id,
    ar.salon_id,
    ar.employee_id,
    ar.requested_amount,
    COALESCE((
      SELECT SUM(asl.amount)
      FROM employee_advance_settlements asl
      WHERE asl.salon_id = ar.salon_id
        AND asl.advance_request_id = ar.id
        AND asl.workflow_status = 'EFFECTIVE'
    ), 0)::numeric AS effective_settled_amount
  FROM employee_advance_requests ar
  JOIN advances source_advance
    ON source_advance.id = ar.advance_id
   AND source_advance.salon_id = ar.salon_id
  JOIN employee_finance_cutovers cutover
    ON cutover.salon_id = ar.salon_id
  WHERE ar.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
    AND source_advance.advance_date <= cutover.legacy_ends_on
    AND ar.reason LIKE 'Historical legacy advance #%'
    AND COALESCE(ar.entry_type, 'CURRENT') <> 'PAST'
    AND ar.manual_receipt_url IS NULL
), current_advances AS (
  SELECT ar.id, ar.salon_id, ar.requested_amount
  FROM employee_advance_requests ar
  LEFT JOIN advances source_advance
    ON source_advance.id = ar.advance_id
   AND source_advance.salon_id = ar.salon_id
  LEFT JOIN employee_finance_cutovers cutover
    ON cutover.salon_id = ar.salon_id
  WHERE NOT (
    source_advance.id IS NOT NULL
    AND cutover.salon_id IS NOT NULL
    AND source_advance.advance_date <= cutover.legacy_ends_on
    AND ar.reason LIKE 'Historical legacy advance #%'
    AND COALESCE(ar.entry_type, 'CURRENT') <> 'PAST'
    AND ar.manual_receipt_url IS NULL
  )
)
SELECT
  COALESCE((SELECT COUNT(*) FROM legacy_advances), 0) AS legacy_advance_requests,
  COALESCE((SELECT SUM(requested_amount) FROM legacy_advances), 0)::numeric(14,2) AS legacy_amount,
  COALESCE((SELECT COUNT(*) FROM legacy_advances WHERE effective_settled_amount >= requested_amount), 0) AS legacy_closed_requests,
  COALESCE((SELECT SUM(effective_settled_amount) FROM legacy_advances), 0)::numeric(14,2) AS legacy_effective_settlement_amount,
  COALESCE((SELECT COUNT(*) FROM legacy_advances WHERE effective_settled_amount < requested_amount), 0) AS legacy_requests_needing_closure,
  COALESCE((SELECT SUM(requested_amount - effective_settled_amount) FROM legacy_advances WHERE effective_settled_amount < requested_amount), 0)::numeric(14,2) AS legacy_amount_needing_closure,
  COALESCE((SELECT COUNT(*) FROM current_advances), 0) AS current_workflow_requests,
  COALESCE((SELECT SUM(requested_amount) FROM current_advances), 0)::numeric(14,2) AS current_workflow_request_amount;
