// Earnings are recorded once from the performer snapshot when a service becomes
// completed. Later finance phases will add payment and settlement records; this
// module never changes an earning after it has been posted.
export const recordEarningsForCompletedService = async (
  client,
  { salonId, transactionId },
) => {
  const { rows: transactionRows } = await client.query(
    `SELECT id, salon_id, service_date, service_time, entry_type, status
     FROM service_transactions
     WHERE id = $1 AND salon_id = $2
     FOR UPDATE`,
    [transactionId, salonId],
  );

  const transaction = transactionRows[0];
  if (!transaction) return 0;

  const status = String(transaction.status || "").trim().toLowerCase();
  const isCompleted = !transaction.status || status === "completed";
  if (!isCompleted || !transaction.service_date || !transaction.service_time) {
    return 0;
  }

  // Once a transaction has a posted earning, its snapshot is financial history.
  // Existing service-edit code replaces performer rows, so deliberately do not
  // manufacture adjustments from a later edit.
  const { rows: existingRows } = await client.query(
    `SELECT 1
     FROM employee_earnings
     WHERE salon_id = $1 AND source_service_transaction_id = $2
     LIMIT 1`,
    [salonId, transactionId],
  );
  if (existingRows.length) return 0;

  const { rowCount } = await client.query(
    `INSERT INTO employee_earnings (
       salon_id,
       employee_id,
       source_service_transaction_id,
       source_service_performer_id,
       source_service_role_id,
       earning_date,
       earning_time,
       entry_type,
       amount
     )
     SELECT
       sp.salon_id,
       COALESCE(sp.employee_id, sp.preferred_employee_id),
       st.id,
       sp.id,
       sp.service_role_id,
       st.service_date,
       st.service_time,
       COALESCE(st.entry_type, 'current'),
       sp.earned_amount_snapshot
     FROM service_performers sp
     JOIN service_transactions st
       ON st.id = sp.service_transaction_id
      AND st.salon_id = sp.salon_id
     WHERE sp.salon_id = $1
       AND sp.service_transaction_id = $2
       AND COALESCE(sp.employee_id, sp.preferred_employee_id) IS NOT NULL
       AND COALESCE(sp.earned_amount_snapshot, 0) > 0
       AND (st.status IS NULL OR LOWER(TRIM(st.status)) = 'completed')
     ON CONFLICT (salon_id, source_service_performer_id) DO NOTHING`,
    [salonId, transactionId],
  );

  return rowCount || 0;
};
