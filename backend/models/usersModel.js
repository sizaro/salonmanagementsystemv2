import db from './database.js';

// Multipart form submissions turn JavaScript null into the literal text
// "null". Convert all intentionally empty profile values back to SQL NULL
// before PostgreSQL receives them (especially DATE columns).
const nullIfBlank = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return !normalized || ["null", "undefined"].includes(normalized.toLowerCase())
    ? null
    : normalized;
};

/**
 * Fetch all users for a given salon
 */
export const fetchAllUsers = async (salon_id) => {
  const query = `
    SELECT u.id, u.salon_id, u.first_name, u.middle_name, u.last_name,
           u.email, u.birthdate, u.contact, u.next_of_kin,
           u.next_of_kin_contact, u.role, u.gender, u.specialty,
           u.status, u.bio, u.image_url,
           CASE WHEN u.id_document_pdf_url IS NOT NULL
                  OR (u.id_document_front_url IS NOT NULL AND u.id_document_back_url IS NOT NULL)
                THEN TRUE ELSE FALSE END AS has_identity_evidence,
           u.created_at,
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
       AND LOWER(COALESCE(role, '')) IN ('employee', 'manager')
       AND LOWER(COALESCE(status, 'active')) = 'active'
       AND COALESCE(NULLIF(TRIM(specialty), ''), '-') <> '-'
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
                        status, bio, image_url, national_id_number, id_document_front_url, id_document_back_url, id_document_pdf_url, created_at
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
  image_url,
  national_id_number,
  id_document_front_url,
  id_document_back_url,
  id_document_pdf_url,
}) => {
  const query = `
    INSERT INTO users 
      (
        first_name, middle_name, last_name, email, password, 
        birthdate, contact, next_of_kin, next_of_kin_contact, 
        role, gender, specialty, status, bio, image_url, national_id_number, id_document_front_url, id_document_back_url, id_document_pdf_url, salon_id, created_at
      ) 
    VALUES 
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW())
    RETURNING id, salon_id, first_name, middle_name, last_name, email,
              birthdate, contact, next_of_kin, next_of_kin_contact,
              role, gender, specialty, status, bio, image_url, national_id_number, id_document_front_url, id_document_back_url, id_document_pdf_url, created_at;
  `;

  const values = [
    nullIfBlank(first_name),
    nullIfBlank(middle_name),
    nullIfBlank(last_name),
    nullIfBlank(email),
    nullIfBlank(password),
    nullIfBlank(birthdate),
    nullIfBlank(contact),
    nullIfBlank(next_of_kin),
    nullIfBlank(next_of_kin_contact),
    role || 'customer',
    nullIfBlank(gender),
    nullIfBlank(specialty),
    status || 'active',
    nullIfBlank(bio),
    nullIfBlank(image_url),
    nullIfBlank(national_id_number),
    nullIfBlank(id_document_front_url),
    nullIfBlank(id_document_back_url),
    nullIfBlank(id_document_pdf_url),
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
    national_id_number,
    id_document_front_url,
    id_document_back_url,
    id_document_pdf_url,
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
    nullIfBlank(first_name),
    nullIfBlank(middle_name),
    nullIfBlank(last_name),
    nullIfBlank(email),
    nullIfBlank(password),
    nullIfBlank(birthdate),
    nullIfBlank(contact),
    nullIfBlank(next_of_kin),
    nullIfBlank(next_of_kin_contact),
    role || "customer",
    nullIfBlank(gender),
    nullIfBlank(specialty),
    status || "active",
    nullIfBlank(bio),
  ];

  if (nullIfBlank(image_url)) {
    fields.push(`image_url = $${fields.length + 1}`);
    values.push(nullIfBlank(image_url));
  }
  if (national_id_number !== undefined) { fields.push(`national_id_number = $${fields.length + 1}`); values.push(nullIfBlank(national_id_number)); }
  if (nullIfBlank(id_document_front_url)) { fields.push(`id_document_front_url = $${fields.length + 1}`); values.push(nullIfBlank(id_document_front_url)); }
  if (nullIfBlank(id_document_back_url)) { fields.push(`id_document_back_url = $${fields.length + 1}`); values.push(nullIfBlank(id_document_back_url)); }
  if (nullIfBlank(id_document_pdf_url)) { fields.push(`id_document_pdf_url = $${fields.length + 1}`); values.push(nullIfBlank(id_document_pdf_url)); }

  // Add id and salon_id for WHERE clause
  values.push(id, salon_id);

  const query = `
    UPDATE users
    SET ${fields.join(", ")}
    WHERE id = $${values.length - 1} AND salon_id = $${values.length}
    RETURNING id, salon_id, first_name, middle_name, last_name, email,
              birthdate, contact, next_of_kin, next_of_kin_contact,
              role, gender, specialty, status, bio, image_url, national_id_number, id_document_front_url, id_document_back_url, id_document_pdf_url, created_at;
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
  const query = "SELECT * FROM users WHERE email = $1 AND salon_id = $2";
  const result = await db.query(query, [email, salon_id]);
  return result.rows[0];
};

/**
 * Find the authenticated user by ID for a specific salon. Controllers remove
 * the password before returning the object to the browser.
 */
export const findUserById = async (id, salon_id) => {
  const query = `
    SELECT id, salon_id, first_name, middle_name, last_name, email, password,
           birthdate, contact, next_of_kin, next_of_kin_contact, role, gender,
           specialty, status, bio, image_url, created_at
    FROM users 
    WHERE id = $1 AND salon_id = $2
  `;
  const result = await db.query(query, [id, salon_id]);
  return result.rows[0];
};

export const updateOwnCustomerProfile = async ({
  id,
  salon_id,
  first_name,
  middle_name,
  last_name,
  contact,
  gender,
  image_url,
}) => {
  const result = await db.query(
    `UPDATE users
     SET first_name = $1,
         middle_name = $2,
         last_name = $3,
         contact = $4,
         gender = $5,
         image_url = COALESCE($6, image_url)
     WHERE id = $7
       AND salon_id = $8
       AND LOWER(role) = 'customer'
     RETURNING id, salon_id, first_name, middle_name, last_name, email,
               contact, gender, role, status, image_url, created_at`,
    [
      first_name,
      middle_name || null,
      last_name,
      contact || null,
      gender || null,
      image_url || null,
      id,
      salon_id,
    ],
  );
  return result.rows[0] || null;
};

export default {
  fetchAllUsers,
  fetchUserById,
  saveUser,
  UpdateUserById,
  DeleteUserById,
  findUserByEmail,
  findUserById,
};
