import db from './database.js';

/**
 * Save a new advance record
 */
export const saveAdvance = async ({
  employee_id,
  amount,
  description,
  salon_id
}) => {
  const query = `
    INSERT INTO advances (
      employee_id,
      amount,
      description,
      salon_id,
      created_at
    )
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING *;
  `;

  const values = [employee_id, amount, description, salon_id];
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Fetch all advances created today (Uganda timezone)
 */
export const fetchAllAdvances = async (salon_id) => {
  const query = `
    SELECT a.*, (a.created_at AT TIME ZONE 'Africa/Kampala') AS created_at
    FROM advances a
    WHERE a.salon_id = $1
      AND (a.created_at AT TIME ZONE 'Africa/Kampala')::date = CURRENT_DATE;
  `;
  const result = await db.query(query, [salon_id]);
  return result.rows;
};

/**
 * Fetch a single advance by ID
 */
export const fetchAdvanceById = async (id, salon_id) => {
  const query = `
    SELECT a.*, (a.created_at AT TIME ZONE 'Africa/Kampala') AS created_at
    FROM advances a
    WHERE a.id = $1
      AND a.salon_id = $2;
  `;
  const result = await db.query(query, [id, salon_id]);
  return result.rows[0];
};

/**
 * Update an advance record by ID
 */
export const UpdateAdvanceById = async ({
  id,
  employee_id,
  amount,
  description,
  created_at,
  salon_id
}) => {
  console.log(
    "data in the advances model",
    id,
    employee_id,
    amount,
    description,
    created_at,
    salon_id
  );

  const query = `
    UPDATE advances
    SET 
      employee_id = $1,
      amount = $2,
      description = $3,
      created_at = $4
    WHERE id = $5
      AND salon_id = $6
    RETURNING *;
  `;

  const values = [
    employee_id,
    amount,
    description,
    created_at,
    id,
    salon_id
  ];

  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Delete an advance by ID
 */
export const DeleteAdvanceById = async (id, salon_id) => {
  const query = `
    DELETE FROM advances
    WHERE id = $1
      AND salon_id = $2
    RETURNING id;
  `;
  const result = await db.query(query, [id, salon_id]);
  return result.rowCount > 0;
};

export default {
  saveAdvance,
  fetchAllAdvances,
  fetchAdvanceById,
  UpdateAdvanceById,
  DeleteAdvanceById
};
