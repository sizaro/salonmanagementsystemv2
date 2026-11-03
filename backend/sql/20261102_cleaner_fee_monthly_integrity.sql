-- Applies the strict monthly cleaner-fee guard to databases where the first
-- employee-fee migration was already run during development.
-- A voided row remains evidence of the month's decision; edit it before any
-- settlement instead of creating another deduction for that employee/month.

DROP INDEX IF EXISTS employee_fee_obligations_cleaner_period_uq;

CREATE UNIQUE INDEX IF NOT EXISTS employee_fee_obligations_cleaner_period_uq
  ON employee_fee_obligations (salon_id, employee_id, fee_type, fee_period)
  WHERE fee_type = 'CLEANER_FEE';
