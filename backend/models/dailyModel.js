import db from "./database.js";

// ===============================
// SERVICES
// ===============================
export const getServicesByDay = async (dateString, salon_id) => {
  console.log("date string in models", dateString, "salon_id", salon_id);

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
      ON sd.id = st.service_definition_id
    JOIN service_sections sec
      ON sec.id = sd.section_id

    -- lateral join for performers aggregation
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

    -- lateral join for materials aggregation
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

    WHERE st.service_timestamp::DATE = $1
      AND (st.status IS NULL OR LOWER(st.status) = 'completed')
      AND st.salon_id = $2

    ORDER BY st.service_timestamp DESC;
  `;

  const { rows } = await db.query(query, [dateString, salon_id]);

  return rows.map(row => {
    if (Array.isArray(row.materials)) {
      row.materials = Array.from(
        new Map(row.materials.map(m => [m.material_name, m])).values()
      );
    } else {
      row.materials = [];
    }
    return row;
  });
};

// ===============================
// EXPENSES
// ===============================
export const getExpensesByDay = async (dateString, salon_id) => {
  const query = `
    SELECT *
    FROM expenses
    WHERE created_at::DATE = $1
      AND salon_id = $2
    ORDER BY id DESC;
  `;
  const { rows } = await db.query(query, [dateString, salon_id]);
  return rows;
};

// ===============================
// SALARY ADVANCES
// ===============================
export const getAdvancesByDay = async (dateString, salon_id) => {
  const query = `
    SELECT 
      a.*,
      u.first_name,
      u.last_name
    FROM advances a
    LEFT JOIN users u ON a.employee_id = u.id
    WHERE a.created_at::DATE = $1
      AND a.salon_id = $2
    ORDER BY a.id DESC;
  `;
  const { rows } = await db.query(query, [dateString, salon_id]);
  return rows;
};

// ===============================
// EMPLOYEE CLOCKINGS
// ===============================
export const getClockingsByDay = async (dateString, salon_id) => {
  const query = `
    SELECT 
      ec.*,
      u.first_name,
      u.last_name
    FROM employee_clocking ec
    LEFT JOIN users u ON ec.employee_id = u.id
    WHERE ec.clock_in::DATE = $1
      AND ec.salon_id = $2
    ORDER BY ec.id DESC;
  `;
  const { rows } = await db.query(query, [dateString, salon_id]);
  return rows;
};

// ===============================
// TAG FEES
// ===============================
export const getTagFeesByDay = async (dateString, salon_id) => {
  const query = `
    SELECT 
      tf.*, 
      CONCAT(u.first_name, ' ', u.last_name) AS employee_name
    FROM tag_fee tf
    LEFT JOIN users u ON tf.employee_id = u.id
    WHERE tf.created_at::DATE = $1
      AND tf.salon_id = $2
    ORDER BY tf.id DESC;
  `;
  const { rows } = await db.query(query, [dateString, salon_id]);
  return rows;
};

// ===============================
// LATE FEES
// ===============================
export const getLateFeesByDay = async (dateString, salon_id) => {
  const query = `
    SELECT 
      lf.*, 
      CONCAT(u.first_name, ' ', u.last_name) AS employee_name
    FROM late_fees lf
    LEFT JOIN users u ON lf.employee_id = u.id
    WHERE lf.created_at::DATE = $1
      AND lf.salon_id = $2
    ORDER BY lf.id DESC;
  `;
  const { rows } = await db.query(query, [dateString, salon_id]);
  return rows;
};

// ===============================
// EMPLOYEES (Users with role employee/manager/owner)
// ===============================
export const fetchAllEmployees = async (salon_id) => {
  const query = `
    SELECT u.*,
           (u.created_at AT TIME ZONE 'Africa/Kampala') AS employee_time
    FROM users u
    WHERE u.role IN ('employee', 'manager', 'owner')
      AND u.salon_id = $1
    ORDER BY u.id ASC;
  `;
  const result = await db.query(query, [salon_id]);
  return result.rows;
};

// ===============================
// EXPORT ALL
// ===============================
export default {
  getServicesByDay,
  getExpensesByDay,
  getAdvancesByDay,
  getClockingsByDay,
  getTagFeesByDay,
  getLateFeesByDay,
  fetchAllEmployees
};
