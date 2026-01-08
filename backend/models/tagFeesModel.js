import db from './database.js';

/**
 * Save a new tag fee record
 */
export const saveTagFee = async ({ employee_id, amount, reason, salon_id }) => {
  const query = `
    INSERT INTO tag_fee (
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
 * Fetch all tag fees for the salon created today (Uganda timezone)
 */
export const fetchAllTagFees = async (salon_id) => {
  const query = `
    SELECT t.*, (t.created_at AT TIME ZONE 'Africa/Kampala') AS created_at
    FROM tag_fee t
    WHERE t.salon_id = $1
      AND (t.created_at AT TIME ZONE 'Africa/Kampala')::date = CURRENT_DATE
    ORDER BY id DESC;
  `;
  const result = await db.query(query, [salon_id]);
  return result.rows;
};

/**
 * Fetch a single tag fee by ID (only for the salon)
 */
export const fetchTagFeeById = async (id, salon_id) => {
  const query = `
    SELECT t.*, (t.created_at AT TIME ZONE 'Africa/Kampala') AS created_at
    FROM tag_fee t
    WHERE t.id = $1 AND t.salon_id = $2;
  `;
  const result = await db.query(query, [id, salon_id]);
  return result.rows[0];
};

/**
 * Update a tag fee record by ID (only for the salon)
 */
export const UpdateTagFeeById = async ({ id, employee_id, amount, reason, created_at, salon_id }) => {
  const query = `
    UPDATE tag_fee
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
 * Delete a tag fee by ID (only for the salon)
 */
export const DeleteTagFeeById = async (id, salon_id) => {
  const query = `DELETE FROM tag_fee WHERE id = $1 AND salon_id = $2 RETURNING id;`;
  const result = await db.query(query, [id, salon_id]);
  return result.rowCount > 0;
};

export default {
  saveTagFee,
  fetchAllTagFees,
  fetchTagFeeById,
  UpdateTagFeeById,
  DeleteTagFeeById
};
