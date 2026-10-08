import db from "./database.js";

const normalizeDate = (value, label) => {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const error = new Error(`${label} must use YYYY-MM-DD`);
    error.statusCode = 400;
    throw error;
  }
  return String(value);
};

const normalizePeriodType = (value) => {
  const periodType = String(value || "").trim().toUpperCase();
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'].includes(periodType)) {
    const error = new Error('period_type must be DAILY, WEEKLY, MONTHLY, or CUSTOM');
    error.statusCode = 400;
    throw error;
  }
  return periodType;
};

export const getEmployeeFinanceOverview = async ({
  salonId,
  employeeId,
  startDate,
  endDate,
}) => {
  const from = normalizeDate(startDate, "start_date");
  const to = normalizeDate(endDate, "end_date");
  if ((from && !to) || (!from && to)) {
    const error = new Error("start_date and end_date must be supplied together");
    error.statusCode = 400;
    throw error;
  }
  if (from && from > to) {
    const error = new Error("end_date cannot be before start_date");
    error.statusCode = 400;
    throw error;
  }

  const { rows } = await db.query(
    `SELECT
       COALESCE((
         SELECT SUM(ee.amount)
         FROM employee_earnings ee
         WHERE ee.salon_id = $1
           AND ee.employee_id = $2
           AND ($3::date IS NULL OR ee.earning_date >= $3::date)
           AND ($4::date IS NULL OR ee.earning_date <= $4::date)
       ), 0)::numeric AS earned_amount,
       COALESCE((
         SELECT COUNT(*)
         FROM employee_earnings ee
         WHERE ee.salon_id = $1
           AND ee.employee_id = $2
           AND ($3::date IS NULL OR ee.earning_date >= $3::date)
           AND ($4::date IS NULL OR ee.earning_date <= $4::date)
       ), 0)::integer AS earning_entries,
       (
         SELECT MIN(ee.earning_date)::text
         FROM employee_earnings ee
         WHERE ee.salon_id = $1 AND ee.employee_id = $2
           AND ($3::date IS NULL OR ee.earning_date >= $3::date)
           AND ($4::date IS NULL OR ee.earning_date <= $4::date)
       ) AS first_earning_date,
       (
         SELECT MAX(ee.earning_date)::text
         FROM employee_earnings ee
         WHERE ee.salon_id = $1 AND ee.employee_id = $2
           AND ($3::date IS NULL OR ee.earning_date >= $3::date)
           AND ($4::date IS NULL OR ee.earning_date <= $4::date)
       ) AS last_earning_date,
       COALESCE((
         SELECT SUM(ep.requested_amount)
         FROM employee_payments ep
         WHERE ep.salon_id = $1
           AND ep.employee_id = $2
           AND ep.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
           AND ($3::date IS NULL OR COALESCE(ep.disbursed_at, ep.created_at)::date >= $3::date)
           AND ($4::date IS NULL OR COALESCE(ep.disbursed_at, ep.created_at)::date <= $4::date)
       ), 0)::numeric AS paid_amount,
       COALESCE((
         SELECT SUM(asl.amount)
         FROM employee_advance_settlements asl
         WHERE asl.salon_id = $1
           AND asl.employee_id = $2
           AND asl.settlement_method = 'PAYROLL_DEDUCTION'
           AND ($3::date IS NULL OR asl.settled_at::date >= $3::date)
           AND ($4::date IS NULL OR asl.settled_at::date <= $4::date)
       ), 0)::numeric AS payroll_deductions,
       COALESCE((
         SELECT SUM(ar.requested_amount)
         FROM employee_advance_requests ar
         WHERE ar.salon_id = $1
           AND ar.employee_id = $2
           AND ar.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
       ), 0)::numeric AS advances_disbursed,
       COALESCE((
         SELECT SUM(asl.amount)
         FROM employee_advance_settlements asl
         WHERE asl.salon_id = $1
           AND asl.employee_id = $2
       ), 0)::numeric AS advances_settled`,
    [salonId, employeeId, from, to],
  );

  const overview = rows[0];
  return {
    employee_id: Number(employeeId),
    start_date: from,
    end_date: to,
    earned_amount: Number(overview.earned_amount || 0),
    earning_entries: Number(overview.earning_entries || 0),
    first_earning_date: overview.first_earning_date || null,
    last_earning_date: overview.last_earning_date || null,
    paid_amount: Number(overview.paid_amount || 0),
    payroll_deductions: Number(overview.payroll_deductions || 0),
    advances_disbursed: Number(overview.advances_disbursed || 0),
    advances_settled: Number(overview.advances_settled || 0),
    advances_outstanding: Math.max(
      Number(overview.advances_disbursed || 0) - Number(overview.advances_settled || 0),
      0,
    ),
    unpaid_amount: Math.max(
      Number(overview.earned_amount || 0)
        - Number(overview.paid_amount || 0)
        - Number(overview.payroll_deductions || 0),
      0,
    ),
    payment_state: "RECORDED",
  };
};

export const getSalonFinanceSummary = async ({ salonId }) => {
  const { rows } = await db.query(
    `SELECT
       COALESCE((
         SELECT SUM(ee.amount)
         FROM employee_earnings ee
         WHERE ee.salon_id = $1
       ), 0)::numeric AS earned_amount,
       COALESCE((
         SELECT COUNT(*)
         FROM employee_earnings ee
         WHERE ee.salon_id = $1
       ), 0)::integer AS earning_entries,
       COALESCE((
         SELECT SUM(ep.requested_amount)
         FROM employee_payments ep
         WHERE ep.salon_id = $1
           AND ep.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
       ), 0)::numeric AS paid_amount,
       COALESCE((
         SELECT SUM(asl.amount)
         FROM employee_advance_settlements asl
         WHERE asl.salon_id = $1
           AND asl.settlement_method = 'PAYROLL_DEDUCTION'
       ), 0)::numeric AS payroll_deductions,
       COALESCE((
         SELECT COUNT(*)
         FROM employee_advance_requests ar
         WHERE ar.salon_id = $1
           AND ar.workflow_status = 'REQUESTED'
       ), 0)::integer AS pending_advance_requests`,
    [salonId],
  );
  const summary = rows[0];
  const earned = Number(summary.earned_amount || 0);
  const paid = Number(summary.paid_amount || 0);
  const payrollDeductions = Number(summary.payroll_deductions || 0);
  return {
    earned_amount: earned,
    paid_amount: paid,
    payroll_deductions: payrollDeductions,
    unpaid_amount: Math.max(earned - paid - payrollDeductions, 0),
    earning_entries: Number(summary.earning_entries || 0),
    pending_advance_requests: Number(summary.pending_advance_requests || 0),
  };
};

export const listEmployeeFinancePeriods = async ({ salonId }) => {
  const { rows } = await db.query(
    `SELECT
       efp.id, efp.name, efp.period_type,
       efp.start_date::text AS start_date,
       efp.end_date::text AS end_date,
       efp.workflow_status,
       efp.created_at, efp.updated_at,
       creator.first_name || ' ' || creator.last_name AS created_by_name
     FROM employee_finance_periods efp
     LEFT JOIN users creator
       ON creator.id = efp.created_by AND creator.salon_id = efp.salon_id
     WHERE efp.salon_id = $1
     ORDER BY efp.start_date DESC, efp.end_date DESC, efp.id DESC`,
    [salonId],
  );
  return rows;
};

export const createEmployeeFinancePeriod = async ({
  salonId,
  createdBy,
  name,
  periodType,
  startDate,
  endDate,
}) => {
  const type = normalizePeriodType(periodType);
  const start = normalizeDate(startDate, "start_date");
  const end = normalizeDate(endDate, "end_date");
  if (!start || !end || end < start) {
    const error = new Error("A valid start_date and end_date are required");
    error.statusCode = 400;
    throw error;
  }

  const { rows } = await db.query(
    `INSERT INTO employee_finance_periods (
       salon_id, name, period_type, start_date, end_date, created_by
     ) VALUES ($1, $2, $3, $4::date, $5::date, $6)
     RETURNING
       id, name, period_type,
       start_date::text AS start_date,
       end_date::text AS end_date,
       workflow_status, created_at, updated_at`,
    [salonId, String(name || "").trim() || null, type, start, end, createdBy],
  );
  return rows[0];
};
