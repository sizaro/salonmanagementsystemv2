import db from "./database.js";

// ===============================
// Create (clock in)
// ===============================
export const saveClocking = async ({ employee_id, salon_id }) => {
  const query = `
    INSERT INTO employee_clocking (
      employee_id,
      salon_id,
      clock_in,
      clock_out,
      created_at,
      updated_at
    )
    SELECT $1, $2, NOW(), NULL, NOW(), NULL
    WHERE NOT EXISTS (
      SELECT 1 FROM employee_clocking
      WHERE employee_id = $1
        AND salon_id = $2
        AND clock_out IS NULL
    )
    RETURNING *;
  `;

  const values = [employee_id, salon_id];
  const { rows } = await db.query(query, values);
  return rows[0];
};

// ===============================
// Update (clock out)
// ===============================
export const updateClockingModel = async ({ employee_id, salon_id }) => {
  const query = `
    UPDATE employee_clocking
    SET clock_out = NOW(), updated_at = NOW()
    WHERE employee_id = $1
      AND salon_id = $2
      AND clock_out IS NULL
    RETURNING *;
  `;

  const values = [employee_id, salon_id];
  const { rows } = await db.query(query, values);
  return rows[0];
};

// ===============================
// Fetch all clockings (by salon)
// ===============================
export const fetchAllClockings = async (salon_id) => {
  const query = `
    SELECT *
    FROM employee_clocking
    WHERE salon_id = $1;
  `;

  const result = await db.query(query, [salon_id]);
  console.log(
    "this is what the data from the database for all clockings",
    result.rows
  );
  return result.rows;
};

export default {
  saveClocking,
  updateClockingModel,
  fetchAllClockings,
};
