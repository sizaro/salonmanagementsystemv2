-- Production preflight for the Salehish Employee Finance alignment.
-- Read-only: this script creates, changes, and deletes nothing.
-- Run this first in the Render PostgreSQL query console and save the result.

WITH required_tables(table_name) AS (
  VALUES
    ('employee_activity_log'),
    ('employee_advance_requests'),
    ('employee_advance_settlements'),
    ('employee_earnings'),
    ('employee_finance_periods'),
    ('employee_finance_receipts'),
    ('employee_finance_receipt_signatures'),
    ('employee_payments'),
    ('owner_business_goals'),
    ('salon_campaigns')
),
eligible_earnings AS (
  SELECT sp.salon_id, sp.id, sp.earned_amount_snapshot
  FROM service_performers sp
  JOIN service_transactions st
    ON st.id = sp.service_transaction_id
   AND st.salon_id = sp.salon_id
  WHERE COALESCE(sp.employee_id, sp.preferred_employee_id) IS NOT NULL
    AND COALESCE(sp.earned_amount_snapshot, 0) > 0
    AND st.service_date IS NOT NULL
    AND st.service_time IS NOT NULL
    AND (st.status IS NULL OR LOWER(TRIM(st.status)) = 'completed')
),
legacy_advances AS (
  SELECT a.*, u.id AS linked_employee_id
  FROM advances a
  LEFT JOIN users u ON u.id = a.employee_id AND u.salon_id = a.salon_id
),
migration_actors AS (
  SELECT s.id AS salon_id,
         COALESCE(
           (SELECT u.id FROM users u WHERE u.id = s.owner_user_id AND u.salon_id = s.id),
           (SELECT u.id FROM users u WHERE u.salon_id = s.id AND LOWER(COALESCE(u.role, '')) = 'owner' ORDER BY u.id LIMIT 1)
         ) AS technical_migration_actor_id
  FROM salons s
)
SELECT jsonb_build_object(
  'connection', jsonb_build_object(
    'database_name', current_database(),
    'connected_as', current_user,
    'postgresql_version', version()
  ),
  'missing_finance_tables', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('table', table_name))
    FROM required_tables
    WHERE to_regclass('public.' || table_name) IS NULL
  ), '[]'::jsonb),
  'legacy_advances', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'salon_id', salon_id,
      'records', records,
      'amount', amount,
      'first_date', first_date,
      'last_date', last_date
    ) ORDER BY salon_id)
    FROM (
      SELECT salon_id, COUNT(*) AS records, COALESCE(SUM(amount), 0) AS amount,
             MIN(advance_date) AS first_date, MAX(advance_date) AS last_date
      FROM advances GROUP BY salon_id
    ) grouped
  ), '[]'::jsonb),
  'legacy_advance_rows_without_linked_employee', (
    SELECT COUNT(*) FROM legacy_advances WHERE linked_employee_id IS NULL
  ),
  'legacy_advance_salons_without_technical_migration_actor', (
    SELECT COUNT(*)
    FROM (SELECT DISTINCT salon_id FROM advances) legacy_salon
    LEFT JOIN migration_actors actor ON actor.salon_id = legacy_salon.salon_id
    WHERE actor.technical_migration_actor_id IS NULL
  ),
  'technical_migration_actors', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'salon_id', actor.salon_id,
      'actor_user_id', actor.technical_migration_actor_id
    ) ORDER BY actor.salon_id)
    FROM migration_actors actor
    WHERE actor.salon_id IN (SELECT DISTINCT salon_id FROM advances)
  ), '[]'::jsonb),
  'eligible_earnings_backfill', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'salon_id', salon_id,
      'performer_rows', performer_rows,
      'earnings_amount', earnings_amount
    ) ORDER BY salon_id)
    FROM (
      SELECT salon_id, COUNT(*) AS performer_rows, SUM(earned_amount_snapshot) AS earnings_amount
      FROM eligible_earnings GROUP BY salon_id
    ) grouped
  ), '[]'::jsonb),
  'migration_history', COALESCE((
    SELECT jsonb_agg(jsonb_build_object('migration', migration, 'batch', batch) ORDER BY batch, migration)
    FROM migrations
  ), '[]'::jsonb)
) AS production_finance_preflight;
