import db from './database.js';

/**
 * Save password reset token
 */
export const createPasswordReset = async (userId, token, expiresAt) => {
  const query = `
    INSERT INTO password_resets (user_id, token, expires_at)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const values = [userId, token, expiresAt];
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Get password reset entry by token (only if not expired))
 */
export const getPasswordResetByToken = async (token) => {
  const query = `
    SELECT * FROM password_resets
    WHERE token=$1 AND expires_at > NOW()
    LIMIT 1;
  `;
  const result = await db.query(query, [token]);
  return result.rows[0];
};

/**
 * Delete a password reset entry by ID
 */
export const deletePasswordResetById = async (id) => {
  const query = `DELETE FROM password_resets WHERE id=$1`;
  await db.query(query, [id]);
};

/**
 * Update user's password by user ID
 */
export const updateUserPasswordById = async (userId, hashedPassword) => {
  const query = `UPDATE users SET password=$1 WHERE id=$2`;
  await db.query(query, [hashedPassword, userId]);
};
