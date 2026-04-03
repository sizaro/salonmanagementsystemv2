import db from "./database.js";
import { generateSlug } from "../utils/slugify.js";

/**
 * Create a new salon profile
 */
export const createSalonProfile = async ({ salon_id, name, tagline, logo, slug }) => {
  const query = `
    INSERT INTO salon_profile (salon_id, name, tagline, logo, slug, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
    RETURNING *;
  `;
  const values = [salon_id, name, tagline || null, logo || null, slug];
  const result = await db.query(query, values);
  return result.rows[0];
};

/**
 * Fetch salon profile by salon_id
 */
export const getSalonProfileBySalonId = async (salon_id) => {
  const query = `SELECT * FROM salon_profile WHERE salon_id = $1;`;
  const result = await db.query(query, [salon_id]);
  return result.rows[0];
};

/**
 * Update salon profile
 */
export const updateSalonProfile = async ({ salon_id, name, tagline, logo, slug }) => {
  const query = `
    UPDATE salon_profile
    SET name = $1, tagline = $2, logo = $3, slug = $4, updated_at = NOW()
    WHERE salon_id = $5
    RETURNING *;
  `;
  const values = [name, tagline || null, logo || null, slug, salon_id];
  const result = await db.query(query, values);
  return result.rows[0];
};



export const setupSalonProfile = async (req, res) => {
  try {
    const { salon_id, name, tagline, logo } = req.body;

    if (!salon_id || !name) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingProfile = await getSalonProfileBySalonId(salon_id);
    if (existingProfile) {
      return res.status(200).json({ message: "Profile already exists", profile: existingProfile });
    }

    // generate a unique slug
    let slug = generateSlug(name);

    // optional: ensure slug is unique (append number if exists)
    let count = 1;
    let slugExists = await db.query("SELECT id FROM salon_profile WHERE slug = $1", [slug]);
    while (slugExists.rows.length > 0) {
      slug = `${generateSlug(name)}-${count}`;
      count++;
      slugExists = await db.query("SELECT id FROM salon_profile WHERE slug = $1", [slug]);
    }

    const profile = await createSalonProfile({ salon_id, name, tagline, logo, slug });

    res.status(201).json({ message: "Salon profile created", profile });
  } catch (err) {
    console.error("Error setting up salon profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};