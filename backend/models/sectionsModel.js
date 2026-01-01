import db from "./database.js";

// Fetch all sections for a specific salon
export const fetchSectionsModel = async (salon_id) => {
  const query = `SELECT * FROM service_sections WHERE salon_id = $1 ORDER BY id ASC`;
  const result = await db.query(query, [salon_id]);
  return result.rows;
};

// Fetch one section by ID for a specific salon
export const fetchSectionByIdModel = async (id, salon_id) => {
  const query = `SELECT * FROM service_sections WHERE id = $1 AND salon_id = $2`;
  const result = await db.query(query, [id, salon_id]);
  return result.rows[0];
};

// Create a new section for a salon
export const createSectionModel = async ({ section_name, salon_id }) => {
  const query = `
    INSERT INTO service_sections (section_name, salon_id)
    VALUES ($1, $2)
    RETURNING *
  `;
  const result = await db.query(query, [section_name, salon_id]);
  return result.rows[0];
};

// Update a section for a salon
export const updateSectionModel = async ({ id, section_name, salon_id }) => {
  const query = `
    UPDATE service_sections
    SET section_name = $1
    WHERE id = $2 AND salon_id = $3
    RETURNING *
  `;
  const result = await db.query(query, [section_name, id, salon_id]);
  return result.rows[0]; // null if nothing updated
};

// Delete a section for a salon
export const deleteSectionModel = async (id, salon_id) => {
  const query = `DELETE FROM service_sections WHERE id = $1 AND salon_id = $2 RETURNING *`;
  const result = await db.query(query, [id, salon_id]);
  return !!result.rows[0]; // true if deleted, false if not
};






// import db from "./database.js";

// // Fetch all sections
// export const fetchSectionsModel = async () => {
//   const query = `SELECT * FROM service_sections ORDER BY id ASC`;
//   const result = await db.query(query);
//   return result.rows;
// };

// // Fetch one section by ID
// export const fetchSectionByIdModel = async (id) => {
//   const query = `SELECT * FROM service_sections WHERE id = $1`;
//   const result = await db.query(query, [id]);
//   return result.rows[0];
// };

// // Create a new section
// export const createSectionModel = async (sectionData) => {
//   const { section_name } = sectionData;
//   const query = `
//     INSERT INTO service_sections (section_name)
//     VALUES ($1)
//     RETURNING *
//   `;
//   const result = await db.query(query, [section_name]);
//   return result.rows[0];
// };

// // Update a section
// export const updateSectionModel = async (sectionData) => {
//   console.log("object in update section model", sectionData)
//   const { section_name, id } = sectionData;
//   console.log("id in update section model", id)
  
//   const query = `
//     UPDATE service_sections
//     SET section_name = $1
//     WHERE id = $2
//     RETURNING *
//   `;
//   const result = await db.query(query, [section_name, id]);
//   return result.rows[0];
// };

// // Delete a section
// export const deleteSectionModel = async (id) => {
//   const query = `DELETE FROM service_sections WHERE id = $1 RETURNING *`;
//   const result = await db.query(query, [id]);
//   return result.rows[0];
// };
