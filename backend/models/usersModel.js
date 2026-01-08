import db from './database.js';

/**
 * Fetch all users for a given salon
 */
export const fetchAllUsers = async (salon_id) => {
  const query = `
    SELECT u.*,
           (u.created_at AT TIME ZONE 'Africa/Kampala') AS user_time
    FROM users u
    WHERE u.salon_id = $1
    ORDER BY u.id ASC;
  `;
  const result = await db.query(query, [salon_id]);
  return result.rows;
};

/**
 * Fetch single user by ID for a given salon
 */
export const fetchUserById = async (id, salon_id) => {
  const query = `SELECT * FROM users WHERE id = $1 AND salon_id = $2;`;
  const result = await db.query(query, [id, salon_id]);
  return result.rows[0];
};

/**
 * Save new user
 */
export const saveUser = async ({
  salon_id,
  first_name,
  middle_name,
  last_name,
  email,
  password,
  birthdate,
  contact,
  next_of_kin,
  next_of_kin_contact,
  role,
  specialty,
  status,
  bio,
  image_url
}) => {
  const query = `
    INSERT INTO users 
      (
        first_name, middle_name, last_name, email, password, 
        birthdate, contact, next_of_kin, next_of_kin_contact, 
        role, specialty, status, bio, image_url, salon_id, created_at
      ) 
    VALUES 
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
    RETURNING *;
  `;

  const values = [
    first_name || null,
    middle_name || null,
    last_name || null,
    email || null,
    password || null,
    birthdate || null,
    contact || null,
    next_of_kin || null,
    next_of_kin_contact || null,
    role || 'customer',
    specialty || null,
    status || 'active',
    bio || null,
    image_url || null,
    salon_id
  ];

  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Update user by ID and salon
 */
export const UpdateUserById = async (data) => {
  let {
    id,
    salon_id,
    first_name,
    middle_name,
    last_name,
    email,
    password,
    birthdate,
    contact,
    next_of_kin,
    next_of_kin_contact,
    role,
    specialty,
    status,
    bio,
    image_url,
  } = data;

  id = parseInt(id, 10);
  if (isNaN(id)) throw new Error("Invalid user ID (NaN or undefined)");

  const fields = [
    "first_name = $1",
    "middle_name = $2",
    "last_name = $3",
    "email = $4",
    "password = $5",
    "birthdate = $6",
    "contact = $7",
    "next_of_kin = $8",
    "next_of_kin_contact = $9",
    "role = $10",
    "specialty = $11",
    "status = $12",
    "bio = $13",
  ];

  const values = [
    first_name || null,
    middle_name || null,
    last_name || null,
    email || null,
    password || null,
    birthdate || null,
    contact || null,
    next_of_kin || null,
    next_of_kin_contact || null,
    role || "customer",
    specialty || null,
    status || "active",
    bio || null,
  ];

  if (image_url !== undefined && image_url !== "") {
    fields.push(`image_url = $${fields.length + 1}`);
    values.push(image_url);
  }

  // Add id and salon_id for WHERE clause
  values.push(id, salon_id);

  const query = `
    UPDATE users
    SET ${fields.join(", ")}
    WHERE id = $${values.length - 1} AND salon_id = $${values.length}
    RETURNING *;
  `;

  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Delete user by ID and salon
 */
export const DeleteUserById = async (id, salon_id) => {
  const query = `DELETE FROM users WHERE id = $1 AND salon_id = $2 RETURNING *;`;
  const result = await db.query(query, [id, salon_id]);
  return result.rows[0];
};

/**
 * Find user by email (for a specific salon)
 */
export const findUserByEmail = async (email, salon_id) => {
  console.log("🔹 findUserByEmail called:", { email, salon_id });
  const query = "SELECT * FROM users WHERE email = $1 AND salon_id = $2";
  const result = await db.query(query, [email, salon_id]);
  return result.rows[0];
};

/**
 * Find user by ID (limited fields) for a specific salon
 */
export const findUserById = async (id, salon_id) => {
  const query = `
    SELECT id, first_name, last_name, email, role, salon_id 
    FROM users 
    WHERE id = $1 AND salon_id = $2
  `;
  const result = await db.query(query, [id, salon_id]);
  return result.rows[0];
};

export default {
  fetchAllUsers,
  fetchUserById,
  saveUser,
  UpdateUserById,
  DeleteUserById,
  findUserByEmail,
  findUserById
};
