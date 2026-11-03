import db from "./database.js";

const forbiddenKeys = new Set([
  "password", "password_hash", "token", "access_token", "refresh_token",
  "session_secret", "api_key", "api_secret", "pin", "signature_data_url",
]);

const sanitize = (value) => {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !forbiddenKeys.has(String(key).toLowerCase()))
      .map(([key, nested]) => [key, sanitize(nested)]),
  );
};

export const appendAuditEvent = async ({
  client = db,
  salonId,
  actorUserId = null,
  actorRole = null,
  action,
  module,
  recordType,
  recordId = null,
  previousValues = null,
  newValues = null,
  reason = null,
  requestId = null,
  outcome = "SUCCESS",
}) => {
  if (!salonId || !action || !module || !recordType) {
    throw new Error("A complete audit event requires salon, action, module, and record type.");
  }
  const { rows } = await client.query(
    `INSERT INTO audit_events (
       salon_id, actor_user_id, actor_role, action, module, record_type, record_id,
       previous_values, new_values, reason, request_id, outcome
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12)
     RETURNING *`,
    [
      Number(salonId), actorUserId ? Number(actorUserId) : null, actorRole || null,
      action, module, recordType, recordId === null ? null : String(recordId),
      previousValues === null ? null : JSON.stringify(sanitize(previousValues)),
      newValues === null ? null : JSON.stringify(sanitize(newValues)),
      reason ? String(reason).slice(0, 2000) : null,
      requestId ? String(requestId).slice(0, 80) : null,
      outcome,
    ],
  );
  return rows[0];
};

export const listAuditEvents = async ({ salonId, limit = 50, offset = 0, module, recordType, recordId }) => {
  const clauses = ["salon_id = $1"];
  const values = [Number(salonId)];
  if (module) { values.push(String(module)); clauses.push(`module = $${values.length}`); }
  if (recordType) { values.push(String(recordType)); clauses.push(`record_type = $${values.length}`); }
  if (recordId) { values.push(String(recordId)); clauses.push(`record_id = $${values.length}`); }
  values.push(Math.max(1, Math.min(Number(limit) || 50, 200)));
  values.push(Math.max(0, Number(offset) || 0));
  const { rows } = await db.query(
    `SELECT ae.*, u.first_name || ' ' || u.last_name AS actor_name
       FROM audit_events ae
       LEFT JOIN users u ON u.id = ae.actor_user_id AND u.salon_id = ae.salon_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY ae.created_at DESC, ae.id DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return rows;
};
