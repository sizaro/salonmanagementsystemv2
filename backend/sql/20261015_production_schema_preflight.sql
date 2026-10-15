-- Read-only production preflight. This is one SELECT statement and cannot alter data or schema.
WITH
finance_table_check AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'table', expected.table_name,
      'existsInProduction', EXISTS (
        SELECT 1
        FROM information_schema.tables t
        WHERE t.table_schema = 'public'
          AND t.table_name = expected.table_name
      )
    )
    ORDER BY expected.table_name
  ) AS result
  FROM (
    VALUES
      ('employee_finance_periods'),
      ('employee_earnings'),
      ('employee_advance_requests'),
      ('employee_payments'),
      ('employee_finance_receipts'),
      ('employee_advance_settlements'),
      ('employee_finance_receipt_signatures'),
      ('employee_activity_log'),
      ('owner_business_goals'),
      ('salon_campaigns')
  ) AS expected(table_name)
),
eligible_earnings AS (
  SELECT COALESCE(jsonb_agg(to_jsonb(row_data) ORDER BY row_data.salon_id), '[]'::jsonb) AS result
  FROM (
    SELECT
      st.salon_id,
      COUNT(*) AS qualifying_performer_rows,
      COUNT(DISTINCT st.id) AS completed_service_transactions,
      COUNT(DISTINCT COALESCE(sp.employee_id, sp.preferred_employee_id)) AS employees_affected,
      COALESCE(SUM(sp.earned_amount_snapshot), 0) AS earnings_amount_to_backfill
    FROM service_performers sp
    JOIN service_transactions st
      ON st.id = sp.service_transaction_id
     AND st.salon_id = sp.salon_id
    WHERE COALESCE(sp.employee_id, sp.preferred_employee_id) IS NOT NULL
      AND COALESCE(sp.earned_amount_snapshot, 0) > 0
      AND st.service_date IS NOT NULL
      AND st.service_time IS NOT NULL
      AND (st.status IS NULL OR LOWER(TRIM(st.status)) = 'completed')
    GROUP BY st.salon_id
  ) AS row_data
),
excluded_earnings AS (
  SELECT COALESCE(jsonb_agg(to_jsonb(row_data) ORDER BY row_data.exclusion_reason), '[]'::jsonb) AS result
  FROM (
    SELECT
      CASE
        WHEN COALESCE(sp.employee_id, sp.preferred_employee_id) IS NULL THEN 'No employee assigned'
        WHEN COALESCE(sp.earned_amount_snapshot, 0) <= 0 THEN 'No positive earnings snapshot'
        WHEN st.service_date IS NULL OR st.service_time IS NULL THEN 'No service date or time'
        ELSE 'Other'
      END AS exclusion_reason,
      COUNT(*) AS performer_rows
    FROM service_performers sp
    JOIN service_transactions st
      ON st.id = sp.service_transaction_id
     AND st.salon_id = sp.salon_id
    WHERE (st.status IS NULL OR LOWER(TRIM(st.status)) = 'completed')
      AND (
        COALESCE(sp.employee_id, sp.preferred_employee_id) IS NULL
        OR COALESCE(sp.earned_amount_snapshot, 0) <= 0
        OR st.service_date IS NULL
        OR st.service_time IS NULL
      )
    GROUP BY 1
  ) AS row_data
),
legacy_advances AS (
  SELECT COALESCE(jsonb_agg(to_jsonb(row_data) ORDER BY row_data.salon_id), '[]'::jsonb) AS result
  FROM (
    SELECT
      salon_id,
      COUNT(*) AS advance_records,
      COALESCE(SUM(amount), 0) AS total_legacy_advance_amount,
      MIN(advance_date) AS first_advance_date,
      MAX(advance_date) AS last_advance_date
    FROM advances
    GROUP BY salon_id
  ) AS row_data
)
SELECT jsonb_pretty(
  jsonb_build_object(
    'connection', jsonb_build_object(
      'databaseName', current_database(),
      'connectedAs', current_user,
      'postgresqlVersion', version()
    ),
    'financeTables', (SELECT result FROM finance_table_check),
    'eligibleEarningsBackfill', (SELECT result FROM eligible_earnings),
    'excludedEarningsBackfill', (SELECT result FROM excluded_earnings),
    'legacyAdvances', (SELECT result FROM legacy_advances)
  )
) AS production_preflight;
