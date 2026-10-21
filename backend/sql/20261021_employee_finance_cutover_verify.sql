-- Run this only after 20261021_employee_finance_cutover.sql has committed.
-- It is read-only. It confirms that historic records were preserved and that
-- only post-cutover controlled finance remains open.
WITH cutover AS (
  SELECT id, salon_id, effective_from_date, legacy_ends_on, created_at
  FROM employee_finance_cutovers
), snapshots AS (
  SELECT
    c.salon_id,
    COUNT(b.id)::integer AS employee_snapshots,
    COALESCE(SUM(b.historical_earnings_paid_amount), 0)::numeric AS historical_earnings_closed,
    COALESCE(SUM(b.historical_advance_settled_amount), 0)::numeric AS historical_advances_closed,
    COALESCE(SUM(b.historical_earning_entries), 0)::integer AS historical_earning_entries,
    COALESCE(SUM(b.historical_advance_entries), 0)::integer AS historical_advance_entries
  FROM cutover c
  LEFT JOIN employee_finance_cutover_employee_balances b ON b.cutover_id = c.id
  GROUP BY c.salon_id
), source_history AS (
  SELECT
    c.salon_id,
    COUNT(a.id)::integer AS preserved_legacy_advance_rows,
    COALESCE(SUM(a.amount), 0)::numeric AS preserved_legacy_advance_amount
  FROM cutover c
  LEFT JOIN advances a
    ON a.salon_id = c.salon_id
   AND a.advance_date <= c.legacy_ends_on
  GROUP BY c.salon_id
), current_earnings AS (
  SELECT
    c.salon_id,
    COUNT(ee.id)::integer AS current_earning_entries,
    COALESCE(SUM(ee.amount), 0)::numeric AS current_earnings_created
  FROM cutover c
  LEFT JOIN employee_earnings ee
    ON ee.salon_id = c.salon_id
   AND ee.earning_date >= c.effective_from_date
  GROUP BY c.salon_id
)
SELECT
  c.salon_id,
  c.effective_from_date,
  c.legacy_ends_on,
  c.created_at AS cutover_recorded_at,
  s.employee_snapshots,
  s.historical_earnings_closed,
  s.historical_advances_closed,
  s.historical_earning_entries,
  s.historical_advance_entries,
  h.preserved_legacy_advance_rows,
  h.preserved_legacy_advance_amount,
  e.current_earning_entries,
  e.current_earnings_created
FROM cutover c
JOIN snapshots s ON s.salon_id = c.salon_id
JOIN source_history h ON h.salon_id = c.salon_id
JOIN current_earnings e ON e.salon_id = c.salon_id
ORDER BY c.salon_id;

-- Optional detail: review every employee's immutable historic closing snapshot.
SELECT
  b.salon_id,
  b.employee_id,
  TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS employee_name,
  b.historical_earnings_paid_amount,
  b.historical_advance_settled_amount,
  b.historical_earning_entries,
  b.historical_advance_entries
FROM employee_finance_cutover_employee_balances b
JOIN users u ON u.id = b.employee_id AND u.salon_id = b.salon_id
ORDER BY b.salon_id, employee_name;