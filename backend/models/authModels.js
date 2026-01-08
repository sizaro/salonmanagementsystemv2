import db from './database.js';

/**
 * Save password reset token
 */
export const createPasswordReset = async (userId, token, expiresAt, salon_id) => {
  const query = `
    INSERT INTO password_resets (user_id, token, salon_id, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const values = [userId, token, salon_id, expiresAt];
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Get password reset entry by token (only if not expired)
 */
export const getPasswordResetByToken = async (token, salon_id) => {
  const query = `
    SELECT * FROM password_resets
    WHERE token = $1
      AND expires_at > NOW()
      AND salon_id = $2
    LIMIT 1;
  `;
  const result = await db.query(query, [token, salon_id]);
  return result.rows[0];
};

/**
 * Delete a password reset entry by ID and salon_id
 */
export const deletePasswordResetById = async (id, salon_id) => {
  const query = `
    DELETE FROM password_resets
    WHERE id = $1 AND salon_id = $2
    RETURNING id;
  `;
  const result = await db.query(query, [id, salon_id]);
  return result.rowCount > 0;
};

/**
 * Update user's password by user ID and salon_id
 */
export const updateUserPasswordById = async (userId, hashedPassword, salon_id) => {
  const query = `
    UPDATE users
    SET password = $1
    WHERE id = $2 AND salon_id = $3
    RETURNING id;
  `;
  const result = await db.query(query, [hashedPassword, userId, salon_id]);
  return result.rowCount > 0;
};

export default {
  createPasswordReset,
  getPasswordResetByToken,
  deletePasswordResetById,
  updateUserPasswordById
};
