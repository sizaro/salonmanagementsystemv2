import db from './database.js';

/**
 * Save a new expense record
 */
export const saveExpense = async ({ name, amount, description, salon_id }) => {
  const query = `
    INSERT INTO expenses (
      name,
      amount,
      description,
      salon_id,
      created_at
    )
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING *;
  `;
  const values = [name, amount, description, salon_id];
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Fetch all expenses for a salon created today (Uganda timezone)
 */
export const fetchAllExpenses = async (salon_id) => {
  const query = `
    SELECT e.*, (e.created_at AT TIME ZONE 'Africa/Kampala') AS created_at
    FROM expenses e
    WHERE e.salon_id = $1
      AND (e.created_at AT TIME ZONE 'Africa/Kampala')::date = CURRENT_DATE
    ORDER BY id DESC;
  `;
  const result = await db.query(query, [salon_id]);
  return result.rows;
};

/**
 * Fetch a single expense by ID and salon_id
 */
export const fetchExpenseById = async (id, salon_id) => {
  const query = `
    SELECT e.*, (e.created_at AT TIME ZONE 'Africa/Kampala') AS created_at
    FROM expenses e
    WHERE e.id = $1 AND e.salon_id = $2;
  `;
  const result = await db.query(query, [id, salon_id]);
  return result.rows[0];
};

/**
 * Update an expense record by ID and salon_id
 */
export const UpdateExpenseById = async ({ id, name, amount, description, created_at, salon_id }) => {
  const query = `
    UPDATE expenses
    SET 
      name = $1,
      amount = $2,
      description = $3,
      created_at = $4
    WHERE id = $5 AND salon_id = $6
    RETURNING *;
  `;
  const values = [name, amount, description, created_at, id, salon_id];
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Delete an expense by ID and salon_id
 */
export const DeleteExpenseById = async (id, salon_id) => {
  const query = `DELETE FROM expenses WHERE id = $1 AND salon_id = $2 RETURNING id;`;
  const result = await db.query(query, [id, salon_id]);
  return result.rowCount > 0;
};

export default {
  saveExpense,
  fetchAllExpenses,
  fetchExpenseById,
  UpdateExpenseById,
  DeleteExpenseById
};
