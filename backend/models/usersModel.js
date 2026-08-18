import db from './database.js';

/**
 * Fetch all users for a given salon
 */
export const fetchAllUsers = async (salon_id) => {
  const query = `
    SELECT u.id, u.salon_id, u.first_name, u.middle_name, u.last_name,
           u.email, u.birthdate, u.contact, u.next_of_kin,
           u.next_of_kin_contact, u.role, u.gender, u.specialty,
           u.status, u.bio, u.image_url, u.created_at,
           (u.created_at AT TIME ZONE 'Africa/Kampala') AS user_time
    FROM users u
    WHERE u.salon_id = $1
    ORDER BY u.id ASC;
  `;
  const result = await db.query(query, [salon_id]);
  return result.rows;
};

export const fetchBookableStaff = async (salon_id) => {
  const { rows } = await db.query(
    `SELECT id, first_name, last_name, specialty, status, image_url
     FROM users
     WHERE salon_id = $1
       AND role <> 'customer'
       AND LOWER(COALESCE(status, 'active')) = 'active'
     ORDER BY first_name, last_name`,
    [salon_id],
  );
  return rows;
};

/**
 * Fetch single user by ID for a given salon
 */
export const fetchUserById = async (id, salon_id) => {
  const query = `SELECT id, salon_id, first_name, middle_name, last_name,
                        email, birthdate, contact, next_of_kin,
                        next_of_kin_contact, role, gender, specialty,
                        status, bio, image_url, created_at
                 FROM users WHERE id = $1 AND salon_id = $2;`;
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
  gender,
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
        role, gender, specialty, status, bio, image_url, salon_id, created_at
      ) 
    VALUES 
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
    RETURNING id, salon_id, first_name, middle_name, last_name, email,
              birthdate, contact, next_of_kin, next_of_kin_contact,
              role, gender, specialty, status, bio, image_url, created_at;
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
    gender || null,
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
    gender,
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
    "password = COALESCE($5, password)",
    "birthdate = $6",
    "contact = $7",
    "next_of_kin = $8",
    "next_of_kin_contact = $9",
    "role = $10",
    "gender = $11",
    "specialty = $12",
    "status = $13",
    "bio = $14",
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
    gender || null,
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
    RETURNING id, salon_id, first_name, middle_name, last_name, email,
              birthdate, contact, next_of_kin, next_of_kin_contact,
              role, gender, specialty, status, bio, image_url, created_at;
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

/**
 * service_transactions still has legacy foreign keys to usermain. Resolve the
 * active users identity to its legacy counterpart until that table is retired.
 */
export const resolveLegacyUserId = async (user_id, salon_id) => {
  return db.transaction(async (client) => {
    const { rows: activeRows } = await client.query(
      `SELECT id, salon_id, first_name, middle_name, last_name, email, password,
              birthdate, contact, next_of_kin, next_of_kin_contact, role,
              specialty, status, bio, image_url
       FROM users
       WHERE id = $1 AND salon_id = $2`,
      [user_id, salon_id],
    );
    const activeUser = activeRows[0];
    if (!activeUser) throw new Error("Active user account not found");

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`legacy-user:${salon_id}:${activeUser.email.toLowerCase()}`],
    );

    const { rows: existingRows } = await client.query(
      `SELECT id FROM usermain
       WHERE salon_id = $1 AND LOWER(email) = LOWER($2)
       ORDER BY id LIMIT 1`,
      [salon_id, activeUser.email],
    );
    if (existingRows[0]) return Number(existingRows[0].id);

    const { rows: insertedRows } = await client.query(
      `INSERT INTO usermain
        (first_name, middle_name, last_name, email, password, birthdate,
         contact, next_of_kin, next_of_kin_contact, role, specialty, status,
         bio, image_url, salon_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        activeUser.first_name || "Customer",
        activeUser.middle_name || null,
        activeUser.last_name || null,
        activeUser.email,
        activeUser.password,
        activeUser.birthdate || null,
        activeUser.contact || null,
        activeUser.next_of_kin || null,
        activeUser.next_of_kin_contact || null,
        activeUser.role,
        activeUser.specialty || "-",
        activeUser.status || "active",
        activeUser.bio || "-",
        activeUser.image_url || "-",
        salon_id,
      ],
    );
    return Number(insertedRows[0].id);
  });
};

export default {
  fetchAllUsers,
  fetchUserById,
  saveUser,
  UpdateUserById,
  DeleteUserById,
  findUserByEmail,
  findUserById,
  resolveLegacyUserId,
};
