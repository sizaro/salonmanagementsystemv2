import db from "./database.js";
import { DateTime } from "luxon";

const TIMEZONE = "Africa/Kampala";

/**
 * Save a new advance record.
 *
 * The business date and time are generated in Kampala time.
 * created_at remains an audit timestamp.
 */
export const saveAdvance = async ({
  employee_id,
  amount,
  description,
  salon_id,
}) => {
  if (!employee_id) {
    throw new Error("employee_id is required");
  }

  if (!salon_id) {
    throw new Error("salon_id is required");
  }

  if (amount === undefined || amount === null || amount === "") {
    throw new Error("amount is required");
  }

  const now = DateTime.now().setZone(TIMEZONE);

  const advance_date = now.toFormat("yyyy-MM-dd");
  const advance_time = now.toFormat("HH:mm:ss");

  const query = `
    INSERT INTO advances (
      employee_id,
      amount,
      description,
      salon_id,
      advance_date,
      advance_time,
      created_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      NOW()
    )
    RETURNING
      id,
      employee_id,
      amount,
      description,
      salon_id,
      advance_date::TEXT AS advance_date,
      advance_time::TEXT AS advance_time,
      created_at;
  `;

  const values = [
    Number(employee_id),
    Number(amount),
    description || null,
    Number(salon_id),
    advance_date,
    advance_time,
  ];

  const { rows } = await db.query(query, values);

  return rows[0];
};

/**
 * Fetch all advances recorded today.
 *
 * Today is calculated using Africa/Kampala rather than the
 * PostgreSQL server timezone.
 */
export const fetchAllAdvances = async (salon_id) => {
  if (!salon_id) {
    throw new Error("salon_id is required");
  }

  const today = DateTime.now().setZone(TIMEZONE).toFormat("yyyy-MM-dd");

  const query = `
    SELECT
      a.id,
      a.employee_id,
      a.amount,
      a.description,
      a.salon_id,
      a.advance_date::TEXT AS advance_date,
      a.advance_time::TEXT AS advance_time,
      a.created_at,

      u.first_name,
      u.last_name

    FROM advances a

    LEFT JOIN users u
      ON u.id = a.employee_id

    WHERE a.salon_id = $1
      AND a.advance_date = $2

    ORDER BY
      a.advance_date DESC,
      a.advance_time DESC,
      a.id DESC;
  `;

  const { rows } = await db.query(query, [Number(salon_id), today]);

  return rows;
};

/**
 * Fetch a single advance by its ID.
 */
export const fetchAdvanceById = async (id, salon_id) => {
  if (!id) {
    throw new Error("Advance id is required");
  }

  if (!salon_id) {
    throw new Error("salon_id is required");
  }

  const query = `
    SELECT
      a.id,
      a.employee_id,
      a.amount,
      a.description,
      a.salon_id,
      a.advance_date::TEXT AS advance_date,
      a.advance_time::TEXT AS advance_time,
      a.created_at,

      u.first_name,
      u.last_name

    FROM advances a

    LEFT JOIN users u
      ON u.id = a.employee_id

    WHERE a.id = $1
      AND a.salon_id = $2

    LIMIT 1;
  `;

  const { rows } = await db.query(query, [Number(id), Number(salon_id)]);

  return rows[0] || null;
};

/**
 * Update an advance.
 *
 * advance_date and advance_time are optional:
 * - when supplied, they replace the saved business date/time;
 * - when omitted, the existing database values are retained.
 *
 * created_at is not changed because it records when the row
 * was originally created.
 */
export const UpdateAdvanceById = async ({
  id,
  employee_id,
  amount,
  description,
  advance_date,
  advance_time,
  salon_id,
}) => {
  if (!id) {
    throw new Error("Advance id is required");
  }

  if (!employee_id) {
    throw new Error("employee_id is required");
  }

  if (!salon_id) {
    throw new Error("salon_id is required");
  }

  if (amount === undefined || amount === null || amount === "") {
    throw new Error("amount is required");
  }

  console.log("Data in advances model update:", {
    id,
    employee_id,
    amount,
    description,
    advance_date,
    advance_time,
    salon_id,
  });

  const query = `
    UPDATE advances

    SET
      employee_id = $1,
      amount = $2,
      description = $3,

      advance_date = COALESCE(
        $4::DATE,
        advance_date
      ),

      advance_time = COALESCE(
        $5::TIME,
        advance_time
      )

    WHERE id = $6
      AND salon_id = $7

    RETURNING
      id,
      employee_id,
      amount,
      description,
      salon_id,
      advance_date::TEXT AS advance_date,
      advance_time::TEXT AS advance_time,
      created_at;
  `;

  const values = [
    Number(employee_id),
    Number(amount),
    description || null,
    advance_date || null,
    advance_time || null,
    Number(id),
    Number(salon_id),
  ];

  const { rows } = await db.query(query, values);

  if (rows.length === 0) {
    throw new Error("Advance not found");
  }

  return rows[0];
};

/**
 * Delete an advance by ID.
 */
export const DeleteAdvanceById = async (id, salon_id) => {
  if (!id) {
    throw new Error("Advance id is required");
  }

  if (!salon_id) {
    throw new Error("salon_id is required");
  }

  const query = `
    DELETE FROM advances

    WHERE id = $1
      AND salon_id = $2

    RETURNING id;
  `;

  const { rows } = await db.query(query, [Number(id), Number(salon_id)]);

  return rows.length > 0;
};

export default {
  saveAdvance,
  fetchAllAdvances,
  fetchAdvanceById,
  UpdateAdvanceById,
  DeleteAdvanceById,
};
