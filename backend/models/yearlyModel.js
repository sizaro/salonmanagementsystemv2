import db from './database.js';

// ===============================
// SERVICES (yearly report with salon_id enforcement)
// ===============================
export const getServicesByYear = async (year, salon_id) => {
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
    JOIN service_definitions sd 
      ON sd.id = st.service_definition_id AND sd.salon_id = $2
    JOIN service_sections sec 
      ON sec.id = sd.section_id AND sec.salon_id = $2

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
      LEFT JOIN service_roles sr 
        ON sr.id = sp.service_role_id AND sr.salon_id = $2
      LEFT JOIN users u 
        ON u.id = sp.employee_id AND u.salon_id = $2
      WHERE sp.service_transaction_id = st.id AND sp.salon_id = $2
    ) perf ON TRUE

    LEFT JOIN LATERAL (
      SELECT json_agg(
               jsonb_build_object(
                 'material_name', sm.material_name,
                 'material_cost', sm.material_cost
               )
             ) AS materials
      FROM service_materials sm
      WHERE sm.service_definition_id = sd.id AND sm.salon_id = $2
    ) mat ON TRUE

    WHERE 
      st.salon_id = $2
      AND EXTRACT(YEAR FROM (st.service_timestamp AT TIME ZONE 'Africa/Kampala')) = $1
      AND (st.status IS NULL OR LOWER(st.status) = 'completed')

    ORDER BY st.service_timestamp DESC;
  `;

  const { rows } = await db.query(query, [year, salon_id]);

  // Remove duplicate materials if needed
  const result = rows.map(row => {
    if (Array.isArray(row.materials)) {
      row.materials = Array.from(
        new Map(row.materials.map(m => [m.material_name, m])).values()
      );
    } else {
      row.materials = [];
    }
    return row;
  });

  console.log("services in the yearly model", result);
  return result;
};


// ===============================
// EXPENSES
// ===============================
export const getExpensesByYear = async (year, salon_id) => {
  const query = `
    SELECT *
    FROM expenses
    WHERE
      salon_id = $2
      AND EXTRACT(YEAR FROM (created_at AT TIME ZONE 'Africa/Kampala')) = $1
    ORDER BY id DESC;
  `;
  const { rows } = await db.query(query, [year, salon_id]);
  return rows;
};

// ===============================
// SALARY ADVANCES
// ===============================
export const getAdvancesByYear = async (year, salon_id) => {
  const query = `
    SELECT 
      a.*,
      u.first_name,
      u.last_name
    FROM advances a
    LEFT JOIN users u ON a.employee_id = u.id
    WHERE
      a.salon_id = $2
      AND EXTRACT(YEAR FROM (a.created_at AT TIME ZONE 'Africa/Kampala')) = $1
    ORDER BY a.id DESC;
  `;
  const { rows } = await db.query(query, [year, salon_id]);
  return rows;
};

// ===============================
// TAG FEES
// ===============================
export const getTagFeesByYear = async (year, salon_id) => {
  const query = `
    SELECT 
      tf.*,
      CONCAT(u.first_name, ' ', u.last_name) AS employee_name
    FROM tag_fee tf
    LEFT JOIN users u ON tf.employee_id = u.id
    WHERE
      tf.salon_id = $2
      AND EXTRACT(YEAR FROM (tf.created_at AT TIME ZONE 'Africa/Kampala')) = $1
    ORDER BY tf.id DESC;
  `;
  const { rows } = await db.query(query, [year, salon_id]);
  return rows;
};

// ===============================
// LATE FEES
// ===============================
export const getLateFeesByYear = async (year, salon_id) => {
  const query = `
    SELECT 
      lf.*,
      CONCAT(u.first_name, ' ', u.last_name) AS employee_name
    FROM late_fees lf
    LEFT JOIN users u ON lf.employee_id = u.id
    WHERE
      lf.salon_id = $2
      AND EXTRACT(YEAR FROM (lf.created_at AT TIME ZONE 'Africa/Kampala')) = $1
    ORDER BY lf.id DESC;
  `;
  const { rows } = await db.query(query, [year, salon_id]);
  return rows;
};

// ===============================
// EXPORT ALL
// ===============================
export default {
  getServicesByYear,
  getExpensesByYear,
  getAdvancesByYear,
  getTagFeesByYear,
  getLateFeesByYear
};
