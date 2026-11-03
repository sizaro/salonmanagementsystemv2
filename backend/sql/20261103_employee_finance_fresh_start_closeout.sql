-- One-time Employee Finance Fresh Start closeout.
--
-- Approved by the salon owner: all employee-finance balances through
-- 3 November 2026 are closed as historical.  From 4 November 2026 onward,
-- the controlled workflow is the sole source of new employee-finance balances.
--
-- This script preserves source records. It does not delete service earnings,
-- advances, fees, or existing payments; it creates labelled closeout evidence.
-- It does not create signatures, receipts, or a new cash movement.
--
-- Run 20261103_employee_finance_fresh_start_preflight.sql first and retain its
-- results with the deployment evidence.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '90s';

DO $$
BEGIN
  IF to_regclass('public.employee_advance_requests') IS NULL
     OR to_regclass('public.employee_advance_settlements') IS NULL
     OR to_regclass('public.employee_fee_obligations') IS NULL
     OR to_regclass('public.employee_fee_settlements') IS NULL
     OR to_regclass('public.employee_payments') IS NULL
     OR to_regclass('public.employee_earnings') IS NULL
     OR to_regclass('public.employee_finance_cutovers') IS NULL
     OR to_regclass('public.employee_activity_log') IS NULL THEN
    RAISE EXCEPTION 'Employee-finance tables are incomplete. Run the approved production schema upgrades first.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM salons s
    WHERE (
      EXISTS (SELECT 1 FROM employee_earnings ee WHERE ee.salon_id = s.id)
      OR EXISTS (SELECT 1 FROM employee_advance_requests ar WHERE ar.salon_id = s.id)
      OR EXISTS (SELECT 1 FROM employee_payments ep WHERE ep.salon_id = s.id)
      OR EXISTS (SELECT 1 FROM employee_fee_obligations o WHERE o.salon_id = s.id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM users owner_user
      WHERE owner_user.salon_id = s.id
        AND (owner_user.id = s.owner_user_id OR LOWER(COALESCE(owner_user.role, '')) = 'owner')
    )
  ) THEN
    RAISE EXCEPTION 'A salon with employee-finance records has no owner account for closeout attribution.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM salons s
    WHERE (
      EXISTS (SELECT 1 FROM employee_earnings ee WHERE ee.salon_id = s.id)
      OR EXISTS (SELECT 1 FROM employee_advance_requests ar WHERE ar.salon_id = s.id)
      OR EXISTS (SELECT 1 FROM employee_payments ep WHERE ep.salon_id = s.id)
      OR EXISTS (SELECT 1 FROM employee_fee_obligations o WHERE o.salon_id = s.id)
    )
    AND NOT EXISTS (SELECT 1 FROM employee_finance_cutovers c WHERE c.salon_id = s.id)
  ) THEN
    RAISE EXCEPTION 'A salon with employee-finance records has no finance cutover boundary.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS employee_finance_closeouts (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  cutoff_date DATE NOT NULL,
  reference VARCHAR(80) NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  closed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_finance_closeouts_salon_cutoff_unique UNIQUE (salon_id, cutoff_date)
);

WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date), actors AS (
  SELECT s.id AS salon_id,
         COALESCE(
           (SELECT u.id FROM users u WHERE u.id = s.owner_user_id AND u.salon_id = s.id),
           (SELECT u.id FROM users u WHERE u.salon_id = s.id AND LOWER(COALESCE(u.role, '')) = 'owner' ORDER BY u.id LIMIT 1)
         ) AS actor_id
  FROM salons s
)
INSERT INTO employee_finance_closeouts (salon_id, cutoff_date, reference, reason, closed_by)
SELECT actors.salon_id, settings.cutoff_date,
       CONCAT('FINCLOSE-', TO_CHAR(settings.cutoff_date, 'YYYYMMDD'), '-', actors.salon_id),
       'Owner-authorized fresh-start closeout. All employee-finance balances through this cutoff are preserved as historical records and do not carry into the controlled workflow beginning the following day.',
       actors.actor_id
FROM actors CROSS JOIN settings
WHERE actors.actor_id IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM employee_earnings ee WHERE ee.salon_id = actors.salon_id)
    OR EXISTS (SELECT 1 FROM employee_advance_requests ar WHERE ar.salon_id = actors.salon_id)
    OR EXISTS (SELECT 1 FROM employee_payments ep WHERE ep.salon_id = actors.salon_id)
    OR EXISTS (SELECT 1 FROM employee_fee_obligations o WHERE o.salon_id = actors.salon_id)
  )
ON CONFLICT (salon_id, cutoff_date) DO NOTHING;

-- An approved or requested advance has no disbursement. It is cancelled as
-- unissued, never converted into a salary deduction.
WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date), updated AS (
  UPDATE employee_advance_requests ar
  SET workflow_status = 'CANCELLED',
      rejection_reason = 'FINANCE_CLOSEOUT:2026-11-03. Cancelled as unissued during the owner-authorized fresh-start closeout; no salary deduction was recorded.',
      updated_at = NOW()
  FROM settings
  WHERE ar.workflow_status IN ('REQUESTED', 'APPROVED')
    AND COALESCE(ar.business_occurred_at, ar.created_at)::date <= settings.cutoff_date
  RETURNING ar.salon_id, ar.id AS advance_request_id, ar.employee_id
)
INSERT INTO employee_activity_log (salon_id, employee_id, actor_id, action, metadata)
SELECT updated.salon_id, updated.employee_id, closeout.closed_by,
       'FINANCE_CLOSEOUT_UNISSUED_ADVANCE_CANCELLED',
       jsonb_build_object('advance_request_id', updated.advance_request_id, 'cutoff_date', '2026-11-03', 'effect', 'Cancelled as unissued; no deduction was created')
FROM updated
JOIN employee_finance_closeouts closeout
  ON closeout.salon_id = updated.salon_id AND closeout.cutoff_date = (SELECT cutoff_date FROM settings);

-- A requested or approved employee payment has not been paid. Keep it as
-- cancelled history rather than treating it as an employee salary settlement.
WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date), updated AS (
  UPDATE employee_payments ep
  SET workflow_status = 'CANCELLED',
      rejection_reason = 'FINANCE_CLOSEOUT:2026-11-03. Cancelled as unissued during the owner-authorized fresh-start closeout.',
      notes = 'FINANCE_CLOSEOUT:2026-11-03. Cancelled as an unissued employee-payment request; no new money moved.',
      updated_at = NOW()
  FROM settings
  WHERE ep.workflow_status IN ('REQUESTED', 'APPROVED')
    AND COALESCE(ep.business_occurred_at, ep.created_at)::date <= settings.cutoff_date
  RETURNING ep.salon_id, ep.id AS employee_payment_id, ep.employee_id
)
INSERT INTO employee_activity_log (salon_id, employee_id, actor_id, action, metadata)
SELECT updated.salon_id, updated.employee_id, closeout.closed_by,
       'FINANCE_CLOSEOUT_UNISSUED_PAYMENT_CANCELLED',
       jsonb_build_object('employee_payment_id', updated.employee_payment_id, 'cutoff_date', '2026-11-03', 'effect', 'Cancelled as unissued; no payment was created')
FROM updated
JOIN employee_finance_closeouts closeout
  ON closeout.salon_id = updated.salon_id AND closeout.cutoff_date = (SELECT cutoff_date FROM settings);

-- Disbursed advances are fully closed as historical salary deductions. Existing
-- effective repayments are honoured; only the still-outstanding remainder is inserted.
WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date), candidates AS (
  SELECT ar.id AS advance_request_id, ar.salon_id, ar.employee_id,
         GREATEST(ar.requested_amount - COALESCE((
           SELECT SUM(s.amount) FROM employee_advance_settlements s
           WHERE s.salon_id = ar.salon_id AND s.advance_request_id = ar.id
             AND s.workflow_status = 'EFFECTIVE'
         ), 0), 0)::numeric AS amount,
         COALESCE(ar.disbursed_at, ar.business_occurred_at, ar.created_at, NOW()) AS occurred_at,
         c.closed_by
  FROM employee_advance_requests ar
  JOIN employee_finance_closeouts c ON c.salon_id = ar.salon_id AND c.cutoff_date = (SELECT cutoff_date FROM settings)
  WHERE ar.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
    AND COALESCE(ar.disbursed_at, ar.business_occurred_at, ar.created_at)::date <= (SELECT cutoff_date FROM settings)
), inserted AS (
  INSERT INTO employee_advance_settlements (
    salon_id, advance_request_id, employee_id, amount, settlement_method,
    notes, receipt_number, settled_by, settled_at, workflow_status
  )
  SELECT salon_id, advance_request_id, employee_id, amount, 'PAYROLL_DEDUCTION',
         'FINANCE_CLOSEOUT:2026-11-03. Owner-authorized historic salary-deduction closure. No new money moved and no employee signature, receipt, acknowledgement, approval, waiver, or individual repayment is implied.',
         CONCAT('FINCLOSE-ADV-', salon_id, '-', advance_request_id),
         closed_by, occurred_at, 'EFFECTIVE'
  FROM candidates
  WHERE amount > 0
  RETURNING id, salon_id, advance_request_id, employee_id, amount, settled_by, settled_at
)
INSERT INTO employee_activity_log (salon_id, employee_id, actor_id, action, metadata, created_at)
SELECT salon_id, employee_id, settled_by, 'FINANCE_CLOSEOUT_ADVANCE_DEDUCTION',
       jsonb_build_object('advance_request_id', advance_request_id, 'settlement_id', id, 'amount', amount, 'cutoff_date', '2026-11-03', 'effect', 'Historical closeout only; no new deduction or signature created'),
       settled_at
FROM inserted;

-- Open employee fees are closed using the same historic deduction basis.
WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date), candidates AS (
  SELECT o.id AS fee_obligation_id, o.salon_id, o.employee_id,
         GREATEST(o.amount - COALESCE((
           SELECT SUM(s.amount) FROM employee_fee_settlements s
           WHERE s.salon_id = o.salon_id AND s.fee_obligation_id = o.id
             AND s.workflow_status = 'EFFECTIVE'
         ), 0), 0)::numeric AS amount,
         ((o.fee_date + COALESCE(o.fee_time, TIME '23:59:59')) AT TIME ZONE 'Africa/Kampala') AS occurred_at,
         c.closed_by
  FROM employee_fee_obligations o
  JOIN employee_finance_closeouts c ON c.salon_id = o.salon_id AND c.cutoff_date = (SELECT cutoff_date FROM settings)
  WHERE o.workflow_status IN ('OPEN', 'SETTLEMENT_PENDING')
    AND o.fee_date <= (SELECT cutoff_date FROM settings)
), inserted AS (
  INSERT INTO employee_fee_settlements (
    salon_id, fee_obligation_id, employee_id, amount, settlement_method,
    workflow_status, notes, receipt_number, settled_by, settled_at
  )
  SELECT salon_id, fee_obligation_id, employee_id, amount, 'PAYROLL_DEDUCTION', 'EFFECTIVE',
         'FINANCE_CLOSEOUT:2026-11-03. Owner-authorized historic fee closure. No new money moved and no employee signature or fresh deduction is implied.',
         CONCAT('FINCLOSE-FEE-', salon_id, '-', fee_obligation_id), closed_by, occurred_at
  FROM candidates
  WHERE amount > 0
  RETURNING id, salon_id, fee_obligation_id, employee_id, amount, settled_by, settled_at
)
INSERT INTO employee_activity_log (salon_id, employee_id, actor_id, action, metadata, created_at)
SELECT salon_id, employee_id, settled_by, 'FINANCE_CLOSEOUT_FEE_DEDUCTION',
       jsonb_build_object('fee_obligation_id', fee_obligation_id, 'settlement_id', id, 'amount', amount, 'cutoff_date', '2026-11-03', 'effect', 'Historical closeout only; no new deduction or signature created'),
       settled_at
FROM inserted;

WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date)
UPDATE employee_fee_obligations o
SET workflow_status = 'SETTLED', updated_at = NOW()
WHERE o.workflow_status IN ('OPEN', 'SETTLEMENT_PENDING')
  AND o.fee_date <= (SELECT cutoff_date FROM settings)
  AND COALESCE((
    SELECT SUM(s.amount) FROM employee_fee_settlements s
    WHERE s.salon_id = o.salon_id AND s.fee_obligation_id = o.id
      AND s.workflow_status = 'EFFECTIVE'
  ), 0) >= o.amount;

-- Remaining earned salary is recorded as historically resolved. This is not a
-- cash disbursement or receipt; it balances the pre-4-November ledger after
-- all recorded salary deductions and already-disbursed employee payments.
WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date), staff AS (
  SELECT u.id AS employee_id, u.salon_id
  FROM users u
  WHERE LOWER(COALESCE(u.role, '')) IN ('employee', 'manager', 'cashier')
), balances AS (
  SELECT staff.salon_id, staff.employee_id, closeout.closed_by,
         GREATEST(
           COALESCE((SELECT SUM(ee.amount) FROM employee_earnings ee
             WHERE ee.salon_id = staff.salon_id AND ee.employee_id = staff.employee_id
               AND ee.earning_date <= (SELECT cutoff_date FROM settings)
               AND NOT EXISTS (SELECT 1 FROM employee_finance_cutovers old_cutover
                 WHERE old_cutover.salon_id = ee.salon_id AND ee.earning_date <= old_cutover.legacy_ends_on)), 0)
           - COALESCE((SELECT SUM(ep.requested_amount) FROM employee_payments ep
             WHERE ep.salon_id = staff.salon_id AND ep.employee_id = staff.employee_id
               AND ep.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
               AND COALESCE(ep.business_occurred_at, ep.disbursed_at, ep.created_at)::date <= (SELECT cutoff_date FROM settings)), 0)
           - COALESCE((SELECT SUM(s.amount) FROM employee_advance_settlements s
             JOIN employee_advance_requests ar ON ar.id = s.advance_request_id AND ar.salon_id = s.salon_id
             LEFT JOIN advances legacy_source ON legacy_source.id = ar.advance_id AND legacy_source.salon_id = ar.salon_id
             LEFT JOIN employee_finance_cutovers old_cutover ON old_cutover.salon_id = ar.salon_id
             WHERE s.salon_id = staff.salon_id AND s.employee_id = staff.employee_id
               AND s.workflow_status = 'EFFECTIVE' AND s.settlement_method = 'PAYROLL_DEDUCTION'
               AND s.settled_at::date <= (SELECT cutoff_date FROM settings)
               AND NOT (legacy_source.id IS NOT NULL AND old_cutover.salon_id IS NOT NULL
                 AND legacy_source.advance_date <= old_cutover.legacy_ends_on
                 AND ar.reason LIKE 'Historical legacy advance #%')), 0)
           - COALESCE((SELECT SUM(s.amount) FROM employee_fee_settlements s
             WHERE s.salon_id = staff.salon_id AND s.employee_id = staff.employee_id
               AND s.workflow_status = 'EFFECTIVE' AND s.settlement_method = 'PAYROLL_DEDUCTION'
               AND s.settled_at::date <= (SELECT cutoff_date FROM settings)), 0),
           0
         )::numeric AS amount
  FROM staff
  JOIN employee_finance_closeouts closeout
    ON closeout.salon_id = staff.salon_id AND closeout.cutoff_date = (SELECT cutoff_date FROM settings)
), inserted AS (
  INSERT INTO employee_payments (
    salon_id, employee_id, requested_amount, payment_method, payment_reference,
    notes, workflow_status, requested_by, approved_by, approved_at,
    disbursed_by, disbursed_at, entry_type, business_occurred_at, late_entry_reason
  )
  SELECT salon_id, employee_id, amount, 'OTHER',
         CONCAT('FINCLOSE-SALARY-', salon_id, '-', employee_id),
         'FINANCE_CLOSEOUT:2026-11-03. Owner-authorized historical resolution of the remaining employee earnings balance. No new cash payment, receipt, or employee acknowledgement is implied.',
         'DISBURSED', closed_by, closed_by,
         ((SELECT cutoff_date FROM settings) + TIME '23:59:59') AT TIME ZONE 'Africa/Kampala',
         closed_by, ((SELECT cutoff_date FROM settings) + TIME '23:59:59') AT TIME ZONE 'Africa/Kampala',
         'PAST', ((SELECT cutoff_date FROM settings) + TIME '23:59:59') AT TIME ZONE 'Africa/Kampala',
         'Owner-authorized fresh-start finance closeout'
  FROM balances
  WHERE amount > 0
    AND NOT EXISTS (
      SELECT 1 FROM employee_payments prior
      WHERE prior.salon_id = balances.salon_id AND prior.employee_id = balances.employee_id
        AND prior.payment_reference = CONCAT('FINCLOSE-SALARY-', balances.salon_id, '-', balances.employee_id)
    )
  RETURNING id, salon_id, employee_id, requested_amount, disbursed_by, disbursed_at
)
INSERT INTO employee_activity_log (salon_id, employee_id, actor_id, action, metadata, created_at)
SELECT salon_id, employee_id, disbursed_by, 'FINANCE_CLOSEOUT_EARNINGS_RESOLVED',
       jsonb_build_object('employee_payment_id', id, 'amount', requested_amount, 'cutoff_date', '2026-11-03', 'effect', 'Historical earnings resolution only; no new cash movement or signature created'),
       disbursed_at
FROM inserted;

-- Move the existing accounting boundary forward only after the historical
-- closeout entries exist. Existing source records remain intact; operational
-- summaries and future pay calculations begin on 4 November 2026.
WITH settings AS (SELECT DATE '2026-11-03' AS cutoff_date)
UPDATE employee_finance_cutovers cutover
SET legacy_ends_on = (SELECT cutoff_date FROM settings),
    effective_from_date = (SELECT cutoff_date + 1 FROM settings),
    reason = CASE
      WHEN cutover.reason LIKE '%Fresh-start closeout extended%' THEN cutover.reason
      ELSE CONCAT(cutover.reason, ' Fresh-start closeout extended the operational boundary through 2026-11-03; individual closeout records preserve the incremental historical resolution.')
    END
WHERE cutover.salon_id IN (
  SELECT salon_id FROM employee_finance_closeouts WHERE cutoff_date = (SELECT cutoff_date FROM settings)
)
  AND cutover.legacy_ends_on < (SELECT cutoff_date FROM settings);

COMMIT;
