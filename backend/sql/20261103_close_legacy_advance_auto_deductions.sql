-- SUPERSEDED for production closeout by
-- 20261103_employee_finance_fresh_start_closeout.sql.
--
-- Close only the advances imported from Salehish's former automatic-deduction
-- workflow. This is a one-time historical cutover record, not a new payment,
-- a new salary deduction, a receipt, an acknowledgement, or a signature.
--
-- Run in pgAdmin only after reviewing 20261103_verify_legacy_advance_cutover.sql.
-- It is safe to re-run: an advance that is already fully closed is not inserted
-- again. A partly-settled legacy advance causes the transaction to stop so that
-- it can be reviewed rather than guessed.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF to_regclass('public.employee_advance_requests') IS NULL
     OR to_regclass('public.employee_advance_settlements') IS NULL
     OR to_regclass('public.employee_finance_cutovers') IS NULL
     OR to_regclass('public.advances') IS NULL
     OR to_regclass('public.employee_activity_log') IS NULL THEN
    RAISE EXCEPTION 'Run the employee-finance alignment and legacy cutover before closing legacy advances.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM employee_advance_requests ar
    JOIN advances source_advance
      ON source_advance.id = ar.advance_id
     AND source_advance.salon_id = ar.salon_id
    JOIN employee_finance_cutovers cutover
      ON cutover.salon_id = ar.salon_id
    JOIN salons s ON s.id = ar.salon_id
    WHERE ar.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
      AND source_advance.advance_date <= cutover.legacy_ends_on
      AND ar.reason LIKE 'Historical legacy advance #%'
      AND COALESCE(ar.entry_type, 'CURRENT') <> 'PAST'
      AND ar.manual_receipt_url IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM users owner_user
        WHERE owner_user.salon_id = s.id
          AND (owner_user.id = s.owner_user_id OR LOWER(COALESCE(owner_user.role, '')) = 'owner')
      )
  ) THEN
    RAISE EXCEPTION 'A salon with legacy advances has no owner account for technical cutover attribution.';
  END IF;

  -- Never combine an already-started individual settlement with an automatic
  -- historic closure. It needs an authorized accounting review instead.
  IF EXISTS (
    WITH candidates AS (
      SELECT ar.id, ar.salon_id, ar.requested_amount,
             COALESCE((
               SELECT SUM(asl.amount)
               FROM employee_advance_settlements asl
               WHERE asl.salon_id = ar.salon_id
                 AND asl.advance_request_id = ar.id
                 AND asl.workflow_status = 'EFFECTIVE'
             ), 0) AS effective_settled_amount
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
    )
    SELECT 1
    FROM candidates
    WHERE effective_settled_amount > 0
      AND effective_settled_amount < requested_amount
  ) THEN
    RAISE EXCEPTION 'A legacy advance has a partial effective settlement. Review it manually; no historical closure was posted.';
  END IF;
END $$;

WITH candidates AS (
  SELECT
    ar.id AS advance_request_id,
    ar.salon_id,
    ar.employee_id,
    ar.requested_amount,
    COALESCE(ar.disbursed_at, (source_advance.advance_date + source_advance.advance_time) AT TIME ZONE 'Africa/Kampala', ar.created_at, NOW()) AS historical_settled_at,
    COALESCE(
      (SELECT u.id
       FROM users u
       WHERE u.id = s.owner_user_id AND u.salon_id = s.id),
      (SELECT u.id
       FROM users u
       WHERE u.salon_id = s.id AND LOWER(COALESCE(u.role, '')) = 'owner'
       ORDER BY u.id
       LIMIT 1)
    ) AS technical_actor_id
  FROM employee_advance_requests ar
  JOIN advances source_advance
    ON source_advance.id = ar.advance_id
   AND source_advance.salon_id = ar.salon_id
  JOIN employee_finance_cutovers cutover
    ON cutover.salon_id = ar.salon_id
  JOIN salons s ON s.id = ar.salon_id
  WHERE ar.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
    AND source_advance.advance_date <= cutover.legacy_ends_on
    AND ar.reason LIKE 'Historical legacy advance #%'
    AND COALESCE(ar.entry_type, 'CURRENT') <> 'PAST'
    AND ar.manual_receipt_url IS NULL
), inserted AS (
  INSERT INTO employee_advance_settlements (
    salon_id, advance_request_id, employee_id, amount,
    settlement_method, notes, receipt_number, settled_by, settled_at,
    workflow_status
  )
  SELECT
    c.salon_id,
    c.advance_request_id,
    c.employee_id,
    c.requested_amount,
    'PAYROLL_DEDUCTION',
    'Historical legacy automatic-deduction closure created at the finance cutover. The former workflow had already recovered this advance from earnings. This record creates no new salary deduction and does not imply a new employee signature, receipt, acknowledgement, approval, waiver, or individual repayment.',
    CONCAT('LGCADV-', c.salon_id, '-', c.advance_request_id),
    c.technical_actor_id,
    c.historical_settled_at,
    'EFFECTIVE'
  FROM candidates c
  WHERE c.technical_actor_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM employee_advance_settlements existing
      WHERE existing.salon_id = c.salon_id
        AND existing.advance_request_id = c.advance_request_id
        AND existing.workflow_status = 'EFFECTIVE'
      GROUP BY existing.advance_request_id
      HAVING COALESCE(SUM(existing.amount), 0) >= c.requested_amount
    )
  RETURNING id, salon_id, advance_request_id, employee_id, amount, settled_by, settled_at
)
INSERT INTO employee_activity_log (
  salon_id, employee_id, actor_id, action, metadata, created_at
)
SELECT
  i.salon_id,
  i.employee_id,
  i.settled_by,
  'LEGACY_ADVANCE_AUTO_DEDUCTION_CLOSED',
  jsonb_build_object(
    'advance_request_id', i.advance_request_id,
    'settlement_id', i.id,
    'amount', i.amount,
    'basis', 'Former automatic salary-deduction workflow',
    'effect', 'Historical closure only; no new deduction or signature created'
  ),
  i.settled_at
FROM inserted i;

COMMIT;
