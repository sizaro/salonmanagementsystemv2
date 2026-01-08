import db from './database.js';

// ===============================
// SERVICES
// ===============================
export const getServicesByMonth = async (year, month, salon_id) => {
  const query = `
    SELECT 
      st.id AS transaction_id,
      st.service_definition_id,
      st.customer_id,
      st.customer_note,
      st.created_by,
      st.service_timestamp AT TIME ZONE 'Africa/Kampala' AS service_time,
      sd.service_name,
      sd.description,
      sd.service_amount AS full_amount,
      sd.salon_amount,
      sd.section_id AS definition_section_id,
      sec.section_name,
      COALESCE(perf.performers, '[]'::json) AS performers,
      COALESCE(mat.materials, '[]'::json) AS materials
    FROM service_transactions st
    JOIN service_definitions sd ON sd.id = st.service_definition_id
    JOIN service_sections sec ON sec.id = sd.section_id
    LEFT JOIN LATERAL (
      SELECT json_agg(
        jsonb_build_object(
          'role_name', sr.role_name,
          'role_amount', sr.earned_amount,
          'employee_id', u.id,
          'first_name', u.first_name,
          'last_name', u.last_name
        )
      ) AS performers
      FROM service_performers sp
      LEFT JOIN service_roles sr ON sr.id = sp.service_role_id
      LEFT JOIN users u ON u.id = sp.employee_id
      WHERE sp.service_transaction_id = st.id
    ) perf ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(
        jsonb_build_object(
          'material_name', sm.material_name,
          'material_cost', sm.material_cost
        )
      ) AS materials
      FROM service_materials sm
      WHERE sm.service_definition_id = sd.id
    ) mat ON TRUE
    WHERE 
      EXTRACT(YEAR FROM (st.service_timestamp AT TIME ZONE 'Africa/Kampala')) = $1
      AND EXTRACT(MONTH FROM (st.service_timestamp AT TIME ZONE 'Africa/Kampala')) = $2
      AND sd.salon_id = $3
      AND (st.status IS NULL OR LOWER(st.status) = 'completed')
    ORDER BY st.service_timestamp DESC;
  `;
  const { rows } = await db.query(query, [year, month, salon_id]);
  return rows;
};

// ===============================
// EXPENSES
// ===============================
export const getExpensesByMonth = async (year, month, salon_id) => {
  const query = `
    SELECT *
    FROM expenses
    WHERE
      EXTRACT(YEAR FROM created_at) = $1
      AND EXTRACT(MONTH FROM created_at) = $2
      AND salon_id = $3
    ORDER BY id DESC;
  `;
  const { rows } = await db.query(query, [year, month, salon_id]);
  return rows;
};

// ===============================
// SALARY ADVANCES
// ===============================
export const getAdvancesByMonth = async (year, month, salon_id) => {
  const query = `
    SELECT 
      a.*,
      u.first_name,
      u.last_name
    FROM advances a
    LEFT JOIN users u ON a.employee_id = u.id
    WHERE
      EXTRACT(YEAR FROM a.created_at) = $1
      AND EXTRACT(MONTH FROM a.created_at) = $2
      AND a.salon_id = $3
    ORDER BY a.id DESC;
  `;
  const { rows } = await db.query(query, [year, month, salon_id]);
  return rows;
};

// ===============================
// TAG FEES
// ===============================
export const getTagFeesByMonth = async (year, month, salon_id) => {
  const query = `
    SELECT 
      tf.*,
      CONCAT(u.first_name, ' ', u.last_name) AS employee_name
    FROM tag_fee tf
    LEFT JOIN users u ON tf.employee_id = u.id
    WHERE
      EXTRACT(YEAR FROM tf.created_at) = $1
      AND EXTRACT(MONTH FROM tf.created_at) = $2
      AND tf.salon_id = $3
    ORDER BY tf.id DESC;
  `;
  const { rows } = await db.query(query, [year, month, salon_id]);
  return rows;
};

// ===============================
// LATE FEES
// ===============================
export const getLateFeesByMonth = async (year, month, salon_id) => {
  const query = `
    SELECT 
      lf.*,
      CONCAT(u.first_name, ' ', u.last_name) AS employee_name
    FROM late_fees lf
    LEFT JOIN users u ON lf.employee_id = u.id
    WHERE
      EXTRACT(YEAR FROM lf.created_at) = $1
      AND EXTRACT(MONTH FROM lf.created_at) = $2
      AND lf.salon_id = $3
    ORDER BY lf.id DESC;
  `;
  const { rows } = await db.query(query, [year, month, salon_id]);
  return rows;
};

// ===============================
// EXPORT ALL
// ===============================
export default {
  getServicesByMonth,
  getExpensesByMonth,
  getAdvancesByMonth,
  getTagFeesByMonth,
  getLateFeesByMonth
};
