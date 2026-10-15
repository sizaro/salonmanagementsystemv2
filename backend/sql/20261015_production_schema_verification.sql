-- Read-only verification after 20261015_production_schema_upgrade.sql.
-- This script does not create, modify, or delete records.

WITH required_tables(table_name) AS (
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
),
expected_earnings AS (
  SELECT
    sp.salon_id,
    sp.id AS source_service_performer_id,
    sp.earned_amount_snapshot::numeric(14,2) AS amount
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
verification AS (
  SELECT
    'requiredTables' AS check_name,
    jsonb_agg(
      jsonb_build_object(
        'table', required_tables.table_name,
        'exists', to_regclass('public.' || required_tables.table_name) IS NOT NULL
      )
      ORDER BY required_tables.table_name
    ) AS result
  FROM required_tables

  UNION ALL

  SELECT
    'earningsBackfill' AS check_name,
    jsonb_build_object(
      'expectedRows', (SELECT COUNT(*) FROM expected_earnings),
      'insertedRowsFromExpectedSources', (
        SELECT COUNT(*)
        FROM employee_earnings ee
        JOIN expected_earnings expected
          ON expected.salon_id = ee.salon_id
         AND expected.source_service_performer_id = ee.source_service_performer_id
      ),
      'expectedAmount', (SELECT COALESCE(SUM(amount), 0) FROM expected_earnings),
      'insertedAmountFromExpectedSources', (
        SELECT COALESCE(SUM(ee.amount), 0)
        FROM employee_earnings ee
        JOIN expected_earnings expected
          ON expected.salon_id = ee.salon_id
         AND expected.source_service_performer_id = ee.source_service_performer_id
      ),
      'duplicateSourceReferences', (
        SELECT COUNT(*)
        FROM (
          SELECT salon_id, source_service_performer_id
          FROM employee_earnings
          GROUP BY salon_id, source_service_performer_id
          HAVING COUNT(*) > 1
        ) duplicates
      )
    ) AS result

  UNION ALL

  SELECT
    'legacyAdvancesPreserved' AS check_name,
    jsonb_agg(
      jsonb_build_object(
        'salonId', salon_id,
        'records', advance_records,
        'amount', total_amount,
        'firstDate', first_advance_date,
        'lastDate', last_advance_date
      )
      ORDER BY salon_id
    ) AS result
  FROM (
    SELECT
      salon_id,
      COUNT(*) AS advance_records,
      COALESCE(SUM(amount), 0) AS total_amount,
      MIN(advance_date) AS first_advance_date,
      MAX(advance_date) AS last_advance_date
    FROM advances
    GROUP BY salon_id
  ) legacy

  UNION ALL

  SELECT
    'newWorkflowStartsEmpty' AS check_name,
    jsonb_build_object(
      'advanceRequests', (SELECT COUNT(*) FROM employee_advance_requests),
      'payments', (SELECT COUNT(*) FROM employee_payments),
      'receipts', (SELECT COUNT(*) FROM employee_finance_receipts),
      'settlements', (SELECT COUNT(*) FROM employee_advance_settlements),
      'signatures', (SELECT COUNT(*) FROM employee_finance_receipt_signatures)
    ) AS result

  UNION ALL

  SELECT
    'settlementConsentSafety' AS check_name,
    jsonb_agg(
      jsonb_build_object(
        'method', settlement_method,
        'workflowStatus', workflow_status,
        'records', record_count,
        'amount', total_amount
      )
      ORDER BY settlement_method, workflow_status
    ) AS result
  FROM (
    SELECT
      settlement_method,
      workflow_status,
      COUNT(*) AS record_count,
      COALESCE(SUM(amount), 0) AS total_amount
    FROM employee_advance_settlements
    GROUP BY settlement_method, workflow_status
  ) settlements
)
SELECT
  check_name,
  COALESCE(result, '[]'::jsonb) AS result
FROM verification
ORDER BY check_name;
