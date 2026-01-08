import db from './database.js';

// OPEN SALON SESSION
export const saveSalonSession = async (salon_id, status) => {
  const query = `
    INSERT INTO salon_sessions (
      salon_id,
      open_time,
      close_time,
      status
    )
    VALUES ($1, NOW(), NULL, $2)
    RETURNING *;
  `;
  const values = [salon_id, status];
  const { rows } = await db.query(query, values);
  return rows[0];
};

// CLOSE SALON SESSION
export const updateSalonSession = async (salon_id, status) => {
  const query = `
    UPDATE salon_sessions
    SET close_time = NOW(),
        status = $1,
        updated_at = NOW()
    WHERE salon_id = $2
      AND status = 'open'
      AND close_time IS NULL
    RETURNING *;
  `;
  const values = [status, salon_id];
  const { rows } = await db.query(query, values);
  return rows[0]; 
};

// GET TODAY'S SALON SESSION
export const fetchTodaySalonSession = async (salon_id) => {
  try {
    const results = await db.query(
      `
      SELECT 
        s.id,
        s.status,
        s.open_time AT TIME ZONE 'Africa/Kampala' AS open_time,
        s.close_time AT TIME ZONE 'Africa/Kampala' AS close_time,
        s.created_at AT TIME ZONE 'Africa/Kampala' AS created_at,
        s.updated_at AT TIME ZONE 'Africa/Kampala' AS updated_at,
        NOW() AS server_now
      FROM salon_sessions s
      WHERE s.salon_id = $1
        AND DATE(s.open_time) = CURRENT_DATE
        AND s.close_time IS NULL
        AND s.status = 'open'
      ORDER BY s.open_time DESC
      LIMIT 1;
      `,
      [salon_id]
    );

    return results.rows[0] || null; // return the open session or null
  } catch (error) {
    console.error("Error fetching today's open salon session:", error);
    throw error;
  }
};
