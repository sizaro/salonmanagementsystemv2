-- A lightweight append-only audit trail for employee record changes.
-- Financial actions retain their own source records and are read alongside
-- this table in the employee profile activity timeline.

CREATE TABLE IF NOT EXISTS employee_activity_log (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS employee_activity_log_employee_idx
  ON employee_activity_log (salon_id, employee_id, created_at DESC);
