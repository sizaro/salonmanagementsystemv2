import db from "./database.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const permittedMetric = new Set(["REVENUE", "CLIENTS", "SERVICES"]);
const permittedPeriod = new Set(["WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"]);
const permittedCampaign = new Set(["ADVERT", "EVENT", "OFFER"]);
const permittedCampaignStatus = new Set(["DRAFT", "ACTIVE", "ENDED", "ARCHIVED"]);
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const day = (value, label) => { if (!ISO_DATE.test(String(value || ""))) throw fail(`${label} must use YYYY-MM-DD`); return String(value); };
const number = (value, label) => { const result = Number(value); if (!Number.isFinite(result) || result <= 0) throw fail(`${label} must be greater than zero`); return result; };
const dateBounds = (start, end) => { const from = day(start, "Start date"); const to = day(end, "End date"); if (to < from) throw fail("End date cannot be before start date"); return { from, to }; };

export async function getOwnerInsights({ salonId, startDate, endDate }) {
  const { from, to } = dateBounds(startDate, endDate);
  const [summaryResult, trendResult, servicesResult, expenseBreakdownResult] = await Promise.all([
    db.query(`SELECT
      COALESCE(SUM(COALESCE(st.charged_service_amount, sd.service_amount, 0)), 0)::numeric AS revenue,
      COUNT(*)::integer AS completed_services,
      COUNT(DISTINCT st.customer_id)::integer AS clients,
      COALESCE((SELECT SUM(e.amount) FROM expenses e WHERE e.salon_id = $1 AND e.expense_date BETWEEN $2::date AND $3::date), 0)::numeric AS expenses
      FROM service_transactions st JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id
      WHERE st.salon_id = $1 AND st.service_date BETWEEN $2::date AND $3::date AND (st.status IS NULL OR LOWER(TRIM(st.status)) = 'completed')`, [salonId, from, to]),
    db.query(`SELECT st.service_date::text AS date, COALESCE(SUM(COALESCE(st.charged_service_amount, sd.service_amount, 0)),0)::numeric AS revenue, COUNT(*)::integer AS services
      FROM service_transactions st JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id
      WHERE st.salon_id = $1 AND st.service_date BETWEEN $2::date AND $3::date AND (st.status IS NULL OR LOWER(TRIM(st.status)) = 'completed')
      GROUP BY st.service_date ORDER BY st.service_date`, [salonId, from, to]),
    db.query(`SELECT sd.service_name, COUNT(*)::integer AS services, COALESCE(SUM(COALESCE(st.charged_service_amount, sd.service_amount,0)),0)::numeric AS revenue
      FROM service_transactions st JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id
      WHERE st.salon_id = $1 AND st.service_date BETWEEN $2::date AND $3::date AND (st.status IS NULL OR LOWER(TRIM(st.status)) = 'completed')
      GROUP BY sd.id, sd.service_name ORDER BY revenue DESC LIMIT 6`, [salonId, from, to]),
    db.query(`SELECT COALESCE(NULLIF(TRIM(e.name), ''), 'Other') AS label,
      COALESCE(SUM(e.amount), 0)::numeric AS amount
      FROM expenses e
      WHERE e.salon_id = $1 AND e.expense_date BETWEEN $2::date AND $3::date
      GROUP BY COALESCE(NULLIF(TRIM(e.name), ''), 'Other')
      ORDER BY amount DESC LIMIT 5`, [salonId, from, to]),
  ]);
  // Core reporting must keep working even before the optional owner-goals and
  // campaigns schema has been installed on an existing salon database.
  let goalRows = { rows: [] };
  let campaignRows = { rows: [] };
  let ownerToolsReady = true;
  try {
    [goalRows, campaignRows] = await Promise.all([
      db.query(`SELECT * FROM owner_business_goals WHERE salon_id = $1 AND status = 'ACTIVE' ORDER BY period_end, created_at DESC`, [salonId]),
      db.query(`SELECT * FROM salon_campaigns WHERE salon_id = $1 AND status <> 'ARCHIVED' ORDER BY starts_at DESC, id DESC`, [salonId]),
    ]);
  } catch (error) {
    if (error?.code !== "42P01") throw error;
    ownerToolsReady = false;
  }
  const summary = summaryResult.rows[0] || {};
  const values = { REVENUE: Number(summary.revenue || 0), CLIENTS: Number(summary.clients || 0), SERVICES: Number(summary.completed_services || 0) };
  const goals = await Promise.all(goalRows.rows.map(async (goal) => {
    const metric = goal.metric;
    const actual = await db.query(`SELECT
      COALESCE(SUM(COALESCE(st.charged_service_amount, sd.service_amount,0)),0)::numeric AS revenue,
      COUNT(DISTINCT st.customer_id)::integer AS clients, COUNT(*)::integer AS services
      FROM service_transactions st JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id
      WHERE st.salon_id = $1 AND st.service_date BETWEEN $2::date AND $3::date AND (st.status IS NULL OR LOWER(TRIM(st.status)) = 'completed')`, [salonId, goal.period_start, goal.period_end]);
    const current = Number(actual.rows[0][metric.toLowerCase()] || 0);
    return { ...goal, target_value: Number(goal.target_value), actual_value: current, progress_percent: Math.min(100, Math.round((current / Number(goal.target_value)) * 100)), current_window_value: values[metric] };
  }));
  return { setup: { owner_tools_ready: ownerToolsReady }, period: { start_date: from, end_date: to }, summary: { revenue: Number(summary.revenue || 0), expenses: Number(summary.expenses || 0), net: Number(summary.revenue || 0) - Number(summary.expenses || 0), clients: Number(summary.clients || 0), completed_services: Number(summary.completed_services || 0) }, trend: trendResult.rows.map((row) => ({ ...row, revenue: Number(row.revenue || 0) })), top_services: servicesResult.rows.map((row) => ({ ...row, revenue: Number(row.revenue || 0) })), expense_breakdown: expenseBreakdownResult.rows.map((row) => ({ ...row, amount: Number(row.amount || 0) })), goals, campaigns: campaignRows.rows.map((row) => ({ ...row, discount_percent: row.discount_percent === null ? null : Number(row.discount_percent) })) };
}

export async function createGoal({ salonId, actorId, body }) {
  const metric = String(body.metric || "").toUpperCase(); const period = String(body.period_type || "").toUpperCase();
  if (!permittedMetric.has(metric) || !permittedPeriod.has(period)) throw fail("Choose a valid goal metric and period");
  const { from, to } = dateBounds(body.period_start, body.period_end);
  const { rows } = await db.query(`INSERT INTO owner_business_goals (salon_id,title,metric,target_value,period_type,period_start,period_end,rationale,created_by) VALUES ($1,$2,$3,$4,$5,$6::date,$7::date,$8,$9) RETURNING *`, [salonId, String(body.title || "").trim() || `${metric} goal`, metric, number(body.target_value, "Goal target"), period, from, to, String(body.rationale || "").trim() || null, actorId]);
  return rows[0];
}

export async function createCampaign({ salonId, actorId, body }) {
  const type = String(body.campaign_type || "").toUpperCase(); const status = String(body.status || "DRAFT").toUpperCase();
  if (!permittedCampaign.has(type) || !permittedCampaignStatus.has(status)) throw fail("Choose a valid campaign type and status");
  if (!String(body.title || "").trim() || !String(body.description || "").trim()) throw fail("Campaign title and description are required");
  const starts = new Date(body.starts_at); const ends = new Date(body.ends_at); if (Number.isNaN(+starts) || Number.isNaN(+ends) || ends < starts) throw fail("Choose a valid campaign schedule");
  const discount = body.discount_percent === "" || body.discount_percent === null || body.discount_percent === undefined ? null : number(body.discount_percent, "Discount percentage"); if (discount !== null && discount > 100) throw fail("Discount percentage cannot exceed 100");
  const { rows } = await db.query(`INSERT INTO salon_campaigns (salon_id,campaign_type,title,description,discount_percent,starts_at,ends_at,status,is_public,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`, [salonId,type,String(body.title).trim(),String(body.description).trim(),discount,starts.toISOString(),ends.toISOString(),status,Boolean(body.is_public),actorId]);
  return rows[0];
}

export async function updateCampaign({ salonId, id, body }) {
  const status = String(body.status || "").toUpperCase(); if (!permittedCampaignStatus.has(status)) throw fail("Choose a valid campaign status");
  const { rows } = await db.query(`UPDATE salon_campaigns SET status=$1,is_public=$2,updated_at=NOW() WHERE id=$3 AND salon_id=$4 RETURNING *`, [status, Boolean(body.is_public), Number(id), salonId]);
  if (!rows[0]) throw fail("Campaign not found", 404); return rows[0];
}

export async function listPublicCampaigns({ salonId }) {
  const { rows } = await db.query(`SELECT id,campaign_type,title,description,discount_percent,starts_at,ends_at FROM salon_campaigns WHERE salon_id=$1 AND status='ACTIVE' AND is_public=TRUE AND starts_at<=NOW() AND ends_at>=NOW() ORDER BY starts_at`, [salonId]);
  return rows.map((row) => ({ ...row, discount_percent: row.discount_percent === null ? null : Number(row.discount_percent) }));
}
