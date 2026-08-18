import db from "./database.js";
import { servicePricingSelect } from "../utils/servicePricingSql.js";

// ===============================
// SERVICES (week model similar to daily model)
// ===============================

// ===============================
// SERVICES (week model using service_date + service_time)
// ===============================

export const getServicesByDateRange = async (startDate, endDate, salon_id) => {
  const query = `
    SELECT 
      st.id AS transaction_id,
      st.service_definition_id,
      st.customer_id,
      st.customer_note,
      st.created_by,

      -- SERVICE DATE/TIME
      st.service_date,
      st.service_time,

      sd.service_name,
      sd.description,
      ${servicePricingSelect},
      sd.section_id AS definition_section_id,
      sec.section_name,


      COALESCE(perf.performers, '[]'::json) AS performers,
      COALESCE(mat.materials, '[]'::json) AS materials


    FROM service_transactions st


    JOIN service_definitions sd 
      ON sd.id = st.service_definition_id
      AND sd.salon_id = $3


    JOIN service_sections sec
      ON sec.id = sd.section_id
      AND sec.salon_id = $3



    -- PERFORMERS
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
        ON sr.id = sp.service_role_id

      LEFT JOIN users u 
        ON u.id = sp.employee_id
        AND u.salon_id = $3

      WHERE sp.service_transaction_id = st.id

    ) perf ON TRUE



    -- MATERIALS
    LEFT JOIN LATERAL (
      SELECT json_agg(
        jsonb_build_object(
          'material_name', sm.material_name,
          'material_cost', sm.material_cost
        )
      ) AS materials

      FROM service_materials sm

      WHERE sm.service_definition_id = sd.id
        AND sm.salon_id = $3

    ) mat ON TRUE



    WHERE 
      st.salon_id = $3

      AND st.service_date BETWEEN $1 AND $2

      AND (st.status IS NULL OR LOWER(st.status) = 'completed')


    ORDER BY 
      st.service_date DESC,
      st.service_time DESC;

  `;

  const { rows } = await db.query(query, [startDate, endDate, salon_id]);

  const result = rows.map((row) => {
    if (Array.isArray(row.materials)) {
      row.materials = Array.from(
        new Map(row.materials.map((m) => [m.material_name, m])).values(),
      );
    } else {
      row.materials = [];
    }

    return row;
  });

  console.log("services in weekly model", result);

  return result;
};

// ===============================
// EXPENSES
// ===============================
export const getExpensesByDateRange = async (startDate, endDate, salon_id) => {
  const { rows } = await db.query("SELECT * FROM expenses WHERE salon_id=$3 AND (created_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN $1::date AND $2::date ORDER BY id DESC", [startDate, endDate, salon_id]);
  return rows;
};

// ===============================
// SALARY ADVANCES
// ===============================
export const getAdvancesByDateRange = async (startDate, endDate, salon_id) => {
  const query = `
    SELECT
      a.*,
      u.first_name,
      u.last_name

    FROM advances a

    LEFT JOIN users u
      ON a.employee_id = u.id

    WHERE a.salon_id = $3
      AND a.advance_date BETWEEN $1 AND $2

    ORDER BY
      a.advance_date DESC,
      a.advance_time DESC,
      a.id DESC;
  `;

  const { rows } = await db.query(query, [startDate, endDate, salon_id]);

  return rows;
};

export const getClockingsByDateRange = async (startDate, endDate, salon_id) => {
  const { rows } = await db.query(`SELECT ec.*, u.first_name, u.last_name FROM employee_clocking ec LEFT JOIN users u ON u.id = ec.employee_id AND u.salon_id = $3 WHERE ec.salon_id = $3 AND ec.clock_in_date BETWEEN $1::date AND $2::date ORDER BY ec.clock_in_date DESC, ec.clock_in_time DESC`, [startDate, endDate, salon_id]);
  return rows;
};

// ===============================
// TAG FEES
// ===============================
export const getTagFeesByDateRange = async (startDate, endDate, salon_id) => {
  const query = `
    SELECT tf.*, CONCAT(u.first_name, ' ', u.last_name) AS employee_name
    FROM tag_fee tf
    LEFT JOIN users u ON tf.employee_id = u.id
    WHERE tf.salon_id = $3
      AND tf.created_at BETWEEN $1 AND $2
    ORDER BY tf.id DESC;
  `;
  const { rows } = await db.query(query, [startDate, endDate, salon_id]);
  return rows;
};

// ===============================
// LATE FEES
// ===============================
export const getLateFeesByDateRange = async (startDate, endDate, salon_id) => {
  const query = `
    SELECT lf.*, CONCAT(u.first_name, ' ', u.last_name) AS employee_name
    FROM late_fees lf
    LEFT JOIN users u ON lf.employee_id = u.id
    WHERE lf.salon_id = $3
      AND lf.created_at BETWEEN $1 AND $2
    ORDER BY lf.id DESC;
  `;
  const { rows } = await db.query(query, [startDate, endDate, salon_id]);
  return rows;
};

// ===============================
// SALON SESSIONS
// ===============================
export const getSalonSessionsByDateRange = async (
  startDate,
  endDate,
  salon_id,
) => {
  const query = `
    SELECT
      id,
      salon_id,
      status,

      open_date::TEXT AS open_date,
      open_time::TEXT AS open_time,

      close_date::TEXT AS close_date,
      close_time::TEXT AS close_time,

      created_at,
      updated_at

    FROM salon_sessions

    WHERE salon_id = $3
      AND open_date BETWEEN $1::date AND $2::date

    ORDER BY open_date DESC, open_time DESC;
  `;

  const { rows } = await db.query(query, [startDate, endDate, salon_id]);
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
  getServicesByDateRange,
  getExpensesByDateRange,
  getAdvancesByDateRange,
  getClockingsByDateRange,
  getTagFeesByDateRange,
  getLateFeesByDateRange,
  getSalonSessionsByDateRange,
  fetchAllEmployees,
};
