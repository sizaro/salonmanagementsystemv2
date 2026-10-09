import db from "./database.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const areas = {
  OVERVIEW: ["REVENUE", "EXPENSES", "NET"],
  SERVICES: ["TIMES_PERFORMED", "REVENUE"],
  EMPLOYEES: ["SERVICES_PERFORMED", "EARNINGS"],
  ADVANCES: ["COUNT", "AMOUNT", "OUTSTANDING"],
  FINANCE: ["REVENUE", "EXPENSES", "NET"],
  CUSTOMERS: ["VISITS", "SPEND"],
  APPOINTMENTS: ["VOLUME", "COMPLETED", "CANCELLED"],
};

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const completed = "(st.status IS NULL OR LOWER(TRIM(st.status)) = 'completed')";
const serviceValue = "COALESCE(st.charged_service_amount, CASE WHEN LOWER(COALESCE(st.service_source, '')) = 'online_booking' THEN GREATEST(sd.service_amount - 500, 0) ELSE sd.service_amount END, 0)";

function date(value, name) {
  if (!DATE.test(String(value || ""))) throw fail(`${name} must use YYYY-MM-DD`);
  return String(value);
}

function priorPeriod(start, end) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const days = Math.round((endDate - startDate) / 86_400_000) + 1;
  const previousEnd = new Date(startDate.getTime() - 86_400_000);
  const previousStart = new Date(previousEnd.getTime() - (days - 1) * 86_400_000);
  return { start: previousStart.toISOString().slice(0, 10), end: previousEnd.toISOString().slice(0, 10) };
}

function comparison(current, previous) {
  const now = Number(current || 0);
  const before = Number(previous || 0);
  if (before === 0 && now > 0) return { current: now, previous: before, change: null, label: "New activity" };
  if (before === 0) return { current: now, previous: before, change: null, label: "No baseline" };
  const change = ((now - before) / before) * 100;
  return { current: now, previous: before, change: Number(change.toFixed(1)), label: change > 0 ? "Increased" : change < 0 ? "Declined" : "Unchanged" };
}

function samePeriodLastYear(start, end) {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  from.setUTCFullYear(from.getUTCFullYear() - 1);
  to.setUTCFullYear(to.getUTCFullYear() - 1);
  return { start: from.toISOString().slice(0, 10), end: to.toISOString().slice(0, 10) };
}

function normalise({ area, metric, startDate, endDate, start_date, end_date, comparison_mode, previous_start_date, previous_end_date }) {
  const resolvedArea = String(area || "OVERVIEW").toUpperCase();
  const resolvedMetric = String(metric || areas[resolvedArea]?.[0] || "REVENUE").toUpperCase();
  if (!areas[resolvedArea]) throw fail("Choose a supported analytics area");
  if (!areas[resolvedArea].includes(resolvedMetric)) throw fail("Choose a supported measure for this area");
  const start = date(startDate || start_date, "Start date");
  const end = date(endDate || end_date, "End date");
  if (end < start) throw fail("End date cannot be before start date");
  const comparisonMode = String(comparison_mode || "PREVIOUS").toUpperCase();
  let previous = priorPeriod(start, end);
  if (comparisonMode === "LAST_YEAR") previous = samePeriodLastYear(start, end);
  if (comparisonMode === "CUSTOM") {
    const previousStart = date(previous_start_date, "Previous-period start date");
    const previousEnd = date(previous_end_date, "Previous-period end date");
    if (previousEnd < previousStart) throw fail("Previous-period end date cannot be before its start date");
    previous = { start: previousStart, end: previousEnd };
  }
  if (!new Set(["PREVIOUS", "LAST_YEAR", "CUSTOM"]).has(comparisonMode)) throw fail("Choose a valid comparison mode");
  return { area: resolvedArea, metric: resolvedMetric, start, end, previous, comparisonMode };
}

async function serviceReport({ salonId, metric, start, end, previous }) {
  const value = metric === "REVENUE" ? `SUM(${serviceValue})` : "COUNT(st.id)";
  const [rankingResult, currentSeries, previousSeries] = await Promise.all([
    db.query(`SELECT sd.id, sd.service_name AS label,
      COALESCE(${value} FILTER (WHERE st.service_date BETWEEN $2::date AND $3::date), 0)::numeric AS current_value,
      COALESCE(${value} FILTER (WHERE st.service_date BETWEEN $4::date AND $5::date), 0)::numeric AS previous_value
      FROM service_definitions sd
      LEFT JOIN service_transactions st ON st.service_definition_id = sd.id
        AND st.salon_id = sd.salon_id AND ${completed}
        AND st.service_date BETWEEN $4::date AND $3::date
      WHERE sd.salon_id = $1
      GROUP BY sd.id, sd.service_name ORDER BY current_value DESC, sd.service_name`, [salonId, start, end, previous.start, previous.end]),
    db.query(`SELECT st.service_date::text AS date, COALESCE(${value}, 0)::numeric AS value
      FROM service_transactions st JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id
      WHERE st.salon_id = $1 AND ${completed} AND st.service_date BETWEEN $2::date AND $3::date
      GROUP BY st.service_date ORDER BY st.service_date`, [salonId, start, end]),
    db.query(`SELECT st.service_date::text AS date, COALESCE(${value}, 0)::numeric AS value
      FROM service_transactions st JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id
      WHERE st.salon_id = $1 AND ${completed} AND st.service_date BETWEEN $2::date AND $3::date
      GROUP BY st.service_date ORDER BY st.service_date`, [salonId, previous.start, previous.end]),
  ]);
  return reportFromRows(rankingResult.rows, currentSeries.rows, previousSeries.rows, { area: "SERVICES", metric, start, end, previous });
}

async function employeeReport({ salonId, metric, start, end, previous }) {
  const value = metric === "EARNINGS" ? "SUM(COALESCE(sp.earned_amount_snapshot, sr.earned_amount, 0))" : "COUNT(DISTINCT st.id)";
  const rows = await db.query(`SELECT u.id, TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS label,
    COALESCE(${value} FILTER (WHERE st.service_date BETWEEN $2::date AND $3::date), 0)::numeric AS current_value,
    COALESCE(${value} FILTER (WHERE st.service_date BETWEEN $4::date AND $5::date), 0)::numeric AS previous_value
    FROM users u
    LEFT JOIN service_performers sp ON (sp.employee_id = u.id OR sp.preferred_employee_id = u.id) AND sp.salon_id = u.salon_id
    LEFT JOIN service_transactions st ON st.id = sp.service_transaction_id AND st.salon_id = u.salon_id AND ${completed} AND st.service_date BETWEEN $4::date AND $3::date
    LEFT JOIN service_roles sr ON sr.id = sp.service_role_id
    WHERE u.salon_id = $1 AND u.role IN ('employee', 'manager', 'cashier')
    GROUP BY u.id, u.first_name, u.last_name ORDER BY current_value DESC, label`, [salonId, start, end, previous.start, previous.end]);
  return reportFromRows(rows.rows, [], [], { area: "EMPLOYEES", metric, start, end, previous });
}

async function advanceReport({ salonId, metric, start, end, previous }) {
  if (metric === "OUTSTANDING") {
    const rows = await db.query(`SELECT u.id, TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS label,
      COALESCE(SUM(GREATEST(ar.requested_amount - COALESCE((SELECT SUM(asl.amount) FROM employee_advance_settlements asl WHERE asl.advance_request_id = ar.id AND asl.salon_id = ar.salon_id AND asl.settled_at::date <= $3::date), 0), 0)) FILTER (WHERE COALESCE(ar.disbursed_at, ar.created_at)::date <= $3::date AND ar.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')), 0)::numeric AS current_value,
      COALESCE(SUM(GREATEST(ar.requested_amount - COALESCE((SELECT SUM(asl.amount) FROM employee_advance_settlements asl WHERE asl.advance_request_id = ar.id AND asl.salon_id = ar.salon_id AND asl.settled_at::date <= $5::date), 0), 0)) FILTER (WHERE COALESCE(ar.disbursed_at, ar.created_at)::date <= $5::date AND ar.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')), 0)::numeric AS previous_value
      FROM users u LEFT JOIN employee_advance_requests ar ON ar.employee_id = u.id AND ar.salon_id = u.salon_id
      WHERE u.salon_id = $1 AND u.role IN ('employee', 'manager', 'cashier')
      GROUP BY u.id, u.first_name, u.last_name ORDER BY current_value DESC, label`, [salonId, start, end, previous.start, previous.end]);
    return reportFromRows(rows.rows, [], [], { area: "ADVANCES", metric, start, end, previous });
  }
  const value = metric === "COUNT" ? "COUNT(a.id)" : "SUM(a.amount)";
  const rows = await db.query(`SELECT u.id, TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS label,
    COALESCE(${value} FILTER (WHERE a.advance_date BETWEEN $2::date AND $3::date), 0)::numeric AS current_value,
    COALESCE(${value} FILTER (WHERE a.advance_date BETWEEN $4::date AND $5::date), 0)::numeric AS previous_value,
    COALESCE(SUM(a.amount) FILTER (WHERE a.advance_date <= $3::date), 0)::numeric AS total_advanced
    FROM users u LEFT JOIN advances a ON a.employee_id = u.id AND a.salon_id = u.salon_id AND a.advance_date BETWEEN $4::date AND $3::date
    WHERE u.salon_id = $1 AND u.role IN ('employee', 'manager', 'cashier')
    GROUP BY u.id, u.first_name, u.last_name ORDER BY current_value DESC, label`, [salonId, start, end, previous.start, previous.end]);
  return reportFromRows(rows.rows, [], [], { area: "ADVANCES", metric, start, end, previous });
}

async function financeReport({ salonId, metric, start, end, previous }) {
  const [currentResult, previousResult, expenseRows] = await Promise.all([
    financeTotals(salonId, start, end), financeTotals(salonId, previous.start, previous.end),
    db.query(`SELECT COALESCE(NULLIF(TRIM(name), ''), 'Other') AS label, SUM(amount)::numeric AS value
      FROM expenses WHERE salon_id = $1 AND expense_date BETWEEN $2::date AND $3::date
      GROUP BY COALESCE(NULLIF(TRIM(name), ''), 'Other') ORDER BY value DESC LIMIT 5`, [salonId, start, end]),
  ]);
  const current = pickFinance(currentResult.rows[0], metric);
  const before = pickFinance(previousResult.rows[0], metric);
  return { area: "FINANCE", metric, period: { start, end, previous }, summary: comparison(current, before), rankings: expenseRows.rows.map((row) => ({ ...row, current_value: Number(row.value || 0) })), breakdown: expenseRows.rows.map((row) => ({ ...row, value: Number(row.value || 0) })), series_current: [], series_previous: [] };
}

async function financeTotals(salonId, start, end) {
  return db.query(`SELECT
    COALESCE((SELECT SUM(${serviceValue}) FROM service_transactions st JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id WHERE st.salon_id = $1 AND ${completed} AND st.service_date BETWEEN $2::date AND $3::date), 0)::numeric AS revenue,
    COALESCE((SELECT SUM(amount) FROM expenses WHERE salon_id = $1 AND expense_date BETWEEN $2::date AND $3::date), 0)::numeric AS expenses`, [salonId, start, end]);
}

const pickFinance = (row, metric) => { const revenue = Number(row?.revenue || 0); const expenses = Number(row?.expenses || 0); return metric === "EXPENSES" ? expenses : metric === "NET" ? revenue - expenses : revenue; };

async function customerReport({ salonId, metric, start, end, previous }) {
  const value = metric === "SPEND" ? `SUM(${serviceValue})` : "COUNT(st.id)";
  const rows = await db.query(`SELECT u.id, TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS label,
    COALESCE(${value} FILTER (WHERE st.service_date BETWEEN $2::date AND $3::date), 0)::numeric AS current_value,
    COALESCE(${value} FILTER (WHERE st.service_date BETWEEN $4::date AND $5::date), 0)::numeric AS previous_value
    FROM users u LEFT JOIN service_transactions st ON st.customer_id = u.id AND st.salon_id = u.salon_id AND ${completed} AND st.service_date BETWEEN $4::date AND $3::date
    LEFT JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id
    WHERE u.salon_id = $1 AND u.role = 'customer'
    GROUP BY u.id, u.first_name, u.last_name ORDER BY current_value DESC, label`, [salonId, start, end, previous.start, previous.end]);
  return reportFromRows(rows.rows, [], [], { area: "CUSTOMERS", metric, start, end, previous });
}

async function appointmentReport({ salonId, metric, start, end, previous }) {
  const predicate = metric === "CANCELLED" ? "LOWER(COALESCE(st.status, '')) = 'cancelled'" : metric === "COMPLETED" ? completed : "TRUE";
  const rows = await db.query(`SELECT COALESCE(st.service_time::text, 'Unscheduled') AS label,
    COUNT(*) FILTER (WHERE COALESCE(st.appointment_date, st.service_date) BETWEEN $2::date AND $3::date)::numeric AS current_value,
    COUNT(*) FILTER (WHERE COALESCE(st.appointment_date, st.service_date) BETWEEN $4::date AND $5::date)::numeric AS previous_value
    FROM service_transactions st WHERE st.salon_id = $1 AND ${predicate}
      AND COALESCE(st.appointment_date, st.service_date) BETWEEN $4::date AND $3::date
    GROUP BY COALESCE(st.service_time::text, 'Unscheduled') ORDER BY current_value DESC, label`, [salonId, start, end, previous.start, previous.end]);
  return reportFromRows(rows.rows, [], [], { area: "APPOINTMENTS", metric, start, end, previous });
}

function reportFromRows(rows, currentSeries, previousSeries, metadata) {
  const current = rows.reduce((sum, row) => sum + Number(row.current_value || 0), 0);
  const previous = rows.reduce((sum, row) => sum + Number(row.previous_value || 0), 0);
  return { ...metadata, period: { start: metadata.start, end: metadata.end, previous: metadata.previous }, summary: comparison(current, previous), rankings: rows.map((row) => ({ ...row, current_value: Number(row.current_value || 0), previous_value: Number(row.previous_value || 0), comparison: comparison(row.current_value, row.previous_value) })), series_current: currentSeries.map((row) => ({ ...row, value: Number(row.value || 0) })), series_previous: previousSeries.map((row) => ({ ...row, value: Number(row.value || 0) })), breakdown: [] };
}

export async function getStatisticsReport({ salonId, query }) {
  const request = normalise(query);
  const params = { salonId, ...request };
  if (request.area === "SERVICES") return serviceReport(params);
  if (request.area === "EMPLOYEES") return employeeReport(params);
  if (request.area === "ADVANCES") return advanceReport(params);
  if (request.area === "CUSTOMERS") return customerReport(params);
  if (request.area === "APPOINTMENTS") return appointmentReport(params);
  return financeReport({ ...params, metric: request.area === "OVERVIEW" ? "REVENUE" : request.metric });
}

export const statisticsOptions = areas;
