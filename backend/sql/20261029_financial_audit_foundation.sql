-- Append-only audit foundation for sensitive Salehish actions.
-- This migration is additive and does not alter historical business records.

BEGIN;

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  salon_id INTEGER NOT NULL REFERENCES salons(id) ON DELETE RESTRICT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_role VARCHAR(32),
  action VARCHAR(120) NOT NULL,
  module VARCHAR(64) NOT NULL,
  record_type VARCHAR(64) NOT NULL,
  record_id VARCHAR(80),
  previous_values JSONB,
  new_values JSONB,
  reason TEXT,
  request_id VARCHAR(80),
  outcome VARCHAR(24) NOT NULL DEFAULT 'SUCCESS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT audit_events_outcome_check CHECK (outcome IN ('SUCCESS', 'BLOCKED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS audit_events_salon_created_idx
  ON audit_events (salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_record_idx
  ON audit_events (salon_id, record_type, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_actor_idx
  ON audit_events (salon_id, actor_user_id, created_at DESC);

-- Application requests may append audit evidence, but may never rewrite or
-- delete it through the same runtime database role.
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_events_immutable ON audit_events;
CREATE TRIGGER audit_events_immutable
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

COMMIT;
