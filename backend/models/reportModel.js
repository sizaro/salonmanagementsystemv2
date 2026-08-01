import db from "./database.js";

const serviceQuery = `
  SELECT st.id AS transaction_id, st.service_definition_id, st.customer_id, st.customer_note, st.created_by,
    st.service_date::text AS service_date, st.service_time::text AS service_time, st.status,
    sd.service_name, sd.description, sd.service_amount AS full_amount, sd.salon_amount,
    sd.section_id AS definition_section_id, sec.section_name,
    COALESCE((SELECT json_agg(jsonb_build_object('role_name', sr.role_name, 'role_amount', sr.earned_amount, 'employee_id', u.id, 'first_name', u.first_name, 'last_name', u.last_name))
      FROM service_performers sp LEFT JOIN service_roles sr ON sr.id = sp.service_role_id AND sr.salon_id = $3
      LEFT JOIN users u ON u.id = sp.employee_id AND u.salon_id = $3
      WHERE sp.service_transaction_id = st.id AND sp.salon_id = $3), '[]'::json) AS performers,
    COALESCE((SELECT json_agg(jsonb_build_object('material_name', sm.material_name, 'material_cost', sm.material_cost))
      FROM service_materials sm WHERE sm.service_definition_id = sd.id AND sm.salon_id = $3), '[]'::json) AS materials
  FROM service_transactions st
  JOIN service_definitions sd ON sd.id = st.service_definition_id AND sd.salon_id = $3
  JOIN service_sections sec ON sec.id = sd.section_id AND sec.salon_id = $3
  WHERE st.salon_id = $3 AND st.service_date BETWEEN $1::date AND $2::date
    AND (st.status IS NULL OR LOWER(st.status) = 'completed')
  ORDER BY st.service_date DESC, st.service_time DESC`;

export async function getReportData({ salonId, startDate, endDate, timezone = "Africa/Kampala" }) {
  const [services, expenses, advances, clockings, tagFees, lateFees, sessions, employees] = await Promise.all([
    db.query(serviceQuery, [startDate, endDate, salonId]),
    db.query(`SELECT * FROM expenses WHERE salon_id = $3 AND (created_at AT TIME ZONE $4)::date BETWEEN $1::date AND $2::date ORDER BY created_at DESC`, [startDate, endDate, salonId, timezone]),
    db.query(`SELECT a.*, u.first_name, u.last_name FROM advances a LEFT JOIN users u ON u.id = a.employee_id AND u.salon_id = $3 WHERE a.salon_id = $3 AND a.advance_date BETWEEN $1::date AND $2::date ORDER BY a.advance_date DESC, a.advance_time DESC`, [startDate, endDate, salonId]),
    db.query(`SELECT ec.*, u.first_name, u.last_name,
      (ec.clock_in_date + ec.clock_in_time) AS clock_in,
      CASE WHEN ec.clock_out_date IS NOT NULL AND ec.clock_out_time IS NOT NULL
        THEN (ec.clock_out_date + ec.clock_out_time) ELSE NULL END AS clock_out
      FROM employee_clocking ec
      LEFT JOIN users u ON u.id = ec.employee_id AND u.salon_id = $3
      WHERE ec.salon_id = $3 AND ec.clock_in_date BETWEEN $1::date AND $2::date
      ORDER BY ec.clock_in_date DESC, ec.clock_in_time DESC`, [startDate, endDate, salonId]),
    db.query(`SELECT tf.*, CONCAT(u.first_name, ' ', u.last_name) AS employee_name FROM tag_fee tf LEFT JOIN users u ON u.id = tf.employee_id AND u.salon_id = $3 WHERE tf.salon_id = $3 AND (tf.created_at AT TIME ZONE $4)::date BETWEEN $1::date AND $2::date ORDER BY tf.created_at DESC`, [startDate, endDate, salonId, timezone]),
    db.query(`SELECT lf.*, CONCAT(u.first_name, ' ', u.last_name) AS employee_name FROM late_fees lf LEFT JOIN users u ON u.id = lf.employee_id AND u.salon_id = $3 WHERE lf.salon_id = $3 AND (lf.created_at AT TIME ZONE $4)::date BETWEEN $1::date AND $2::date ORDER BY lf.created_at DESC`, [startDate, endDate, salonId, timezone]),
    db.query(`SELECT id, salon_id, status, open_date::text AS open_date, open_time::text AS open_time, close_date::text AS close_date, close_time::text AS close_time, created_at, updated_at FROM salon_sessions WHERE salon_id = $3 AND open_date BETWEEN $1::date AND $2::date ORDER BY open_date DESC, open_time DESC`, [startDate, endDate, salonId]),
    db.query(`SELECT u.*, (u.created_at AT TIME ZONE $2) AS employee_time FROM users u WHERE u.salon_id = $1 AND u.role IN ('employee', 'manager', 'owner') ORDER BY u.id ASC`, [salonId, timezone]),
  ]);
  return {
    period: { startDate, endDate, timezone },
    services: services.rows,
    expenses: expenses.rows,
    advances: advances.rows,
    clockings: clockings.rows,
    tagFees: tagFees.rows,
    lateFees: lateFees.rows,
    sessions: sessions.rows,
    employees: employees.rows,
  };
}
