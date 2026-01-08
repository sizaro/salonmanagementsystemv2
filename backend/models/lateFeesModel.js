import db from './database.js';

/**
 * Save a new late fee record
 */
export const saveLateFee = async ({ employee_id, amount, reason, salon_id }) => {
  const query = `
    INSERT INTO late_fees (
      employee_id,
      amount,
      reason,
      salon_id,
      created_at
    )
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING *;
  `;
  const values = [employee_id, amount, reason, salon_id];
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Fetch all late fees for a specific salon
 */
export const fetchAllLateFees = async (salon_id) => {
  const query = `
    SELECT l.*, (l.created_at AT TIME ZONE 'Africa/Kampala') AS created_at
    FROM late_fees l
    WHERE l.salon_id = $1
    ORDER BY id DESC;
  `;
  const result = await db.query(query, [salon_id]);
  return result.rows;
};

/**
 * Fetch a single late fee by ID for a salon
 */
export const fetchLateFeeById = async (id, salon_id) => {
  const query = `
    SELECT l.*, (l.created_at AT TIME ZONE 'Africa/Kampala') AS created_at
    FROM late_fees l
    WHERE l.id = $1 AND l.salon_id = $2;
  `;
  const result = await db.query(query, [id, salon_id]);
  return result.rows[0];
};

/**
 * Update a late fee record by ID and salon
 */
export const UpdateLateFeeById = async ({ id, employee_id, amount, reason, created_at, salon_id }) => {
  console.log("late fee data in the model", employee_id, amount, reason, created_at, id, salon_id)
  const query = `
    UPDATE late_fees
    SET 
      employee_id = $1,
      amount = $2,
      reason = $3,
      created_at = $4
    WHERE id = $5 AND salon_id = $6
    RETURNING *;
  `;
  const values = [employee_id, amount, reason, created_at, id, salon_id];
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Delete a late fee by ID and salon
 */
export const DeleteLateFeeById = async (id, salon_id) => {
  const query = `DELETE FROM late_fees WHERE id = $1 AND salon_id = $2 RETURNING id;`;
  const result = await db.query(query, [id, salon_id]);
  return result.rowCount > 0;
};

export default {
  saveLateFee,
  fetchAllLateFees,
  fetchLateFeeById,
  UpdateLateFeeById,
  DeleteLateFeeById
};
