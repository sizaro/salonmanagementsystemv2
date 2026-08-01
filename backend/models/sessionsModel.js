import db from "./database.js";
import { DateTime } from "luxon";

const TIMEZONE = "Africa/Kampala";

// OPEN SALON SESSION
export const saveSalonSession = async (salon_id, status) => {
  // First check if there is already an open session
  const existing = await db.query(
    `
    SELECT id
    FROM salon_sessions
    WHERE salon_id = $1
    AND status = 'open'
    AND close_date IS NULL
    AND close_time IS NULL
    LIMIT 1;
    `,
    [salon_id],
  );

  if (existing.rows.length > 0) {
    throw new Error("Salon already has an open session");
  }

  const now = DateTime.now().setZone(TIMEZONE);

  const open_date = now.toFormat("yyyy-MM-dd");

  const open_time = now.toFormat("HH:mm:ss");

  const query = `
    INSERT INTO salon_sessions
    (
      salon_id,
      status,
      open_date,
      open_time
    )
    VALUES ($1,$2,$3,$4)
    RETURNING *;
  `;

  const values = [salon_id, status, open_date, open_time];

  const { rows } = await db.query(query, values);

  return rows[0];
};

// CLOSE SALON SESSION

export const updateSalonSession = async (salon_id, status) => {
  const now = DateTime.now().setZone(TIMEZONE);

  const close_date = now.toFormat("yyyy-MM-dd");

  const close_time = now.toFormat("HH:mm:ss");

  const query = `

 UPDATE salon_sessions

 SET
 close_date = $1,
 close_time = $2,
 status = $3,
 updated_at = NOW()

 WHERE salon_id = $4
 AND status = 'open'
 AND close_date IS NULL
 AND close_time IS NULL

 RETURNING *;

 `;

  const values = [close_date, close_time, status, salon_id];

  const { rows } = await db.query(query, values);

  if (rows.length === 0) {
    throw new Error("No active salon session found");
  }

  return rows[0];
};

export const fetchTodaySalonSession = async (salon_id) => {
  const results = await db.query(
    `
 SELECT
    id,
    status,
    open_date::TEXT AS open_date,
    open_time::TEXT AS open_time,
    close_date::TEXT AS close_date,
    close_time::TEXT AS close_time,
    created_at,
    updated_at
FROM salon_sessions

 WHERE salon_id=$1

 AND status='open'

 AND close_date IS NULL
 AND close_time IS NULL

 ORDER BY id DESC

 LIMIT 1;

 `,
    [salon_id],
  );

  return results.rows[0] || null;
};
