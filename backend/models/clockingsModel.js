import db from "./database.js";
import { DateTime } from "luxon";

const TIMEZONE = "Africa/Kampala";
// ===============================
// Create (clock in)
// ===============================
// Create (clock in)
// ===============================

export const saveClocking = async ({ employee_id, salon_id }) => {
  if (!employee_id || !salon_id) {
    throw new Error("employee_id and salon_id are required");
  }

  const now = DateTime.now().setZone(TIMEZONE);

  const clock_in_date = now.toFormat("yyyy-MM-dd");

  const clock_in_time = now.toFormat("HH:mm:ss");

  const query = `
    INSERT INTO employee_clocking (
      employee_id,
      salon_id,
      clock_in_date,
      clock_in_time,
      clock_out_date,
      clock_out_time,
      created_at,
      updated_at
    )

    SELECT
      $1,
      $2,
      $3,
      $4,
      NULL,
      NULL,
      NOW(),
      NULL

    WHERE NOT EXISTS (
      SELECT 1
      FROM employee_clocking
      WHERE employee_id = $1
        AND salon_id = $2
        AND clock_out_date IS NULL
        AND clock_out_time IS NULL
    )

    RETURNING *;
  `;

  const values = [
    Number(employee_id),
    Number(salon_id),
    clock_in_date,
    clock_in_time,
  ];

  const { rows } = await db.query(query, values);

  if (rows.length === 0) {
    throw new Error("Employee already has an active clock-in");
  }

  return rows[0];
};
// ===============================
// Update (clock out)
// ===============================

export const updateClockingModel = async ({ employee_id, salon_id }) => {
  if (!employee_id || !salon_id) {
    throw new Error("employee_id and salon_id are required");
  }

  const now = DateTime.now().setZone(TIMEZONE);

  const clock_out_date = now.toFormat("yyyy-MM-dd");

  const clock_out_time = now.toFormat("HH:mm:ss");

  const query = `
    UPDATE employee_clocking

    SET
      clock_out_date = $1,
      clock_out_time = $2,
      updated_at = NOW()

    WHERE employee_id = $3
      AND salon_id = $4
      AND clock_out_date IS NULL
      AND clock_out_time IS NULL

    RETURNING *;
  `;

  const values = [
    clock_out_date,
    clock_out_time,
    Number(employee_id),
    Number(salon_id),
  ];

  const { rows } = await db.query(query, values);

  if (rows.length === 0) {
    throw new Error("No active employee clock-in found");
  }

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
    result.rows,
  );
  return result.rows;
};

export default {
  saveClocking,
  updateClockingModel,
  fetchAllClockings,
};
