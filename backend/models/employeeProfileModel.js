import db from "./database.js";
import { getEmployeeFinanceOverview } from "./employeeFinanceModel.js";

const numeric = (value) => Number(value || 0);

export const logEmployeeActivity = async ({
  salonId,
  employeeId,
  actorId = null,
  action,
  metadata = {},
}) => {
  await db.query(
    `INSERT INTO employee_activity_log (
       salon_id, employee_id, actor_id, action, metadata
     ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [salonId, employeeId, actorId, action, JSON.stringify(metadata)],
  );
};

export const employeeHasHistoricalRecords = async ({ salonId, employeeId }) => {
  const { rows } = await db.query(
    `SELECT (
       EXISTS(SELECT 1 FROM service_performers WHERE salon_id = $1 AND employee_id = $2)
       OR EXISTS(SELECT 1 FROM employee_earnings WHERE salon_id = $1 AND employee_id = $2)
       OR EXISTS(SELECT 1 FROM employee_payments WHERE salon_id = $1 AND employee_id = $2)
       OR EXISTS(SELECT 1 FROM employee_advance_requests WHERE salon_id = $1 AND employee_id = $2)
       OR EXISTS(SELECT 1 FROM employee_advance_settlements WHERE salon_id = $1 AND employee_id = $2)
     ) AS has_history`,
    [salonId, employeeId],
  );
  return Boolean(rows[0]?.has_history);
};

const getEmployeeRecord = async ({ salonId, employeeId, includeSensitive }) => {
  const { rows } = await db.query(
    `SELECT
       id, salon_id, first_name, middle_name, last_name, email,
       birthdate::text AS birthdate, contact, next_of_kin, next_of_kin_contact,
       role, gender, specialty, status, bio, image_url, created_at,
       CASE WHEN $3::boolean THEN national_id_number ELSE NULL END AS national_id_number,
       CASE WHEN $3::boolean THEN id_document_front_url ELSE NULL END AS id_document_front_url,
       CASE WHEN $3::boolean THEN id_document_back_url ELSE NULL END AS id_document_back_url,
       CASE WHEN $3::boolean THEN id_document_pdf_url ELSE NULL END AS id_document_pdf_url,
       CASE WHEN id_document_pdf_url IS NOT NULL
              OR (id_document_front_url IS NOT NULL AND id_document_back_url IS NOT NULL)
            THEN TRUE ELSE FALSE END AS has_identity_evidence
     FROM users
     WHERE id = $1 AND salon_id = $2`,
    [employeeId, salonId, includeSensitive],
  );
  return rows[0] || null;
};

const getWork = async ({ salonId, employeeId }) => {
  const [summaryResult, historyResult] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*)::integer AS completed_service_count,
         COALESCE(SUM(ee.amount), 0)::numeric AS earned_amount,
         MIN(ee.earning_date)::text AS first_earning_date,
         MAX(ee.earning_date)::text AS last_earning_date
       FROM employee_earnings ee
       WHERE ee.salon_id = $1 AND ee.employee_id = $2`,
      [salonId, employeeId],
    ),
    db.query(
      `SELECT
         ee.id, ee.earning_date::text AS earning_date,
         ee.earning_time::text AS earning_time, ee.amount,
         ee.entry_type, ee.posted_at, ee.source_service_transaction_id,
         st.status AS service_status,
         sd.service_name,
         st.charged_service_amount
       FROM employee_earnings ee
       LEFT JOIN service_transactions st
         ON st.id = ee.source_service_transaction_id AND st.salon_id = ee.salon_id
       LEFT JOIN service_definitions sd
         ON sd.id = st.service_definition_id AND sd.salon_id = st.salon_id
       WHERE ee.salon_id = $1 AND ee.employee_id = $2
       ORDER BY ee.earning_date DESC, ee.earning_time DESC, ee.id DESC
       LIMIT 80`,
      [salonId, employeeId],
    ),
  ]);
  const summary = summaryResult.rows[0] || {};
  return {
    summary: {
      completed_service_count: Number(summary.completed_service_count || 0),
      earned_amount: numeric(summary.earned_amount),
      first_earning_date: summary.first_earning_date || null,
      last_earning_date: summary.last_earning_date || null,
    },
    history: historyResult.rows.map((row) => ({
      ...row,
      amount: numeric(row.amount),
      charged_service_amount: numeric(row.charged_service_amount),
    })),
  };
};

const getAdvances = async ({ salonId, employeeId }) => {
  const { rows } = await db.query(
    `SELECT
       ar.id, ar.requested_amount, ar.reason, ar.workflow_status,
       ar.created_at, ar.reviewed_at, ar.disbursed_at, ar.acknowledged_at,
       ar.receipt_number,
       COALESCE((
         SELECT SUM(asl.amount)
         FROM employee_advance_settlements asl
         WHERE asl.salon_id = ar.salon_id AND asl.advance_request_id = ar.id
       ), 0)::numeric AS settled_amount,
       GREATEST(ar.requested_amount - COALESCE((
         SELECT SUM(asl.amount)
         FROM employee_advance_settlements asl
         WHERE asl.salon_id = ar.salon_id AND asl.advance_request_id = ar.id
       ), 0), 0)::numeric AS outstanding_amount
     FROM employee_advance_requests ar
     WHERE ar.salon_id = $1 AND ar.employee_id = $2
     ORDER BY ar.created_at DESC, ar.id DESC`,
    [salonId, employeeId],
  );
  return rows.map((row) => ({
    ...row,
    requested_amount: numeric(row.requested_amount),
    settled_amount: numeric(row.settled_amount),
    outstanding_amount: numeric(row.outstanding_amount),
  }));
};

const getFinanceDetails = async ({ salonId, employeeId }) => {
  const [overview, paymentResult, receiptResult, advances] = await Promise.all([
    getEmployeeFinanceOverview({ salonId, employeeId }),
    db.query(
      `SELECT id, requested_amount, payment_method, payment_reference, notes,
              workflow_status, receipt_number, created_at, approved_at,
              disbursed_at, acknowledged_at
       FROM employee_payments
       WHERE salon_id = $1 AND employee_id = $2
       ORDER BY created_at DESC, id DESC`,
      [salonId, employeeId],
    ),
    db.query(
      `SELECT * FROM (
         SELECT r.id, r.receipt_number, r.receipt_type, r.amount,
                r.issued_at, r.acknowledged_at
         FROM employee_finance_receipts r
         WHERE r.salon_id = $1 AND r.employee_id = $2
         UNION ALL
         SELECT asl.id, asl.receipt_number,
                'ADVANCE_SETTLEMENT'::varchar AS receipt_type, asl.amount,
                asl.settled_at AS issued_at, NULL::timestamptz AS acknowledged_at
         FROM employee_advance_settlements asl
         WHERE asl.salon_id = $1 AND asl.employee_id = $2
       ) receipts
       ORDER BY issued_at DESC, id DESC`,
      [salonId, employeeId],
    ),
    getAdvances({ salonId, employeeId }),
  ]);
  return {
    overview,
    payments: paymentResult.rows.map((row) => ({ ...row, requested_amount: numeric(row.requested_amount) })),
    receipts: receiptResult.rows.map((row) => ({ ...row, amount: numeric(row.amount) })),
    advances,
  };
};

const getActivity = async ({ salonId, employeeId }) => {
  const { rows } = await db.query(
    `SELECT * FROM (
       SELECT
         al.id, al.created_at AS occurred_at, al.action,
         al.metadata, 'PROFILE'::varchar AS category,
         TRIM(CONCAT(COALESCE(actor.first_name, ''), ' ', COALESCE(actor.last_name, ''))) AS actor_name
       FROM employee_activity_log al
       LEFT JOIN users actor ON actor.id = al.actor_id AND actor.salon_id = al.salon_id
       WHERE al.salon_id = $1 AND al.employee_id = $2
       UNION ALL
       SELECT ar.id, COALESCE(ar.disbursed_at, ar.created_at),
              'ADVANCE_' || ar.workflow_status, jsonb_build_object('amount', ar.requested_amount),
              'ADVANCE'::varchar, NULL::varchar
       FROM employee_advance_requests ar
       WHERE ar.salon_id = $1 AND ar.employee_id = $2
       UNION ALL
       SELECT ep.id, COALESCE(ep.disbursed_at, ep.created_at),
              'PAYMENT_' || ep.workflow_status, jsonb_build_object('amount', ep.requested_amount),
              'PAYMENT'::varchar, NULL::varchar
       FROM employee_payments ep
       WHERE ep.salon_id = $1 AND ep.employee_id = $2
       UNION ALL
       SELECT asl.id, asl.settled_at,
              'ADVANCE_' || asl.settlement_method, jsonb_build_object('amount', asl.amount),
              'SETTLEMENT'::varchar, NULL::varchar
       FROM employee_advance_settlements asl
       WHERE asl.salon_id = $1 AND asl.employee_id = $2
     ) activity
     ORDER BY occurred_at DESC, id DESC
     LIMIT 100`,
    [salonId, employeeId],
  );
  return rows;
};

export const getEmployeeProfile = async ({ salonId, employeeId, includeSensitive = false }) => {
  const employee = await getEmployeeRecord({ salonId, employeeId, includeSensitive });
  if (!employee) return null;

  const [work, finance, activity] = await Promise.all([
    getWork({ salonId, employeeId }),
    getFinanceDetails({ salonId, employeeId }),
    getActivity({ salonId, employeeId }),
  ]);

  return {
    employee,
    employment: {
      role: employee.role,
      specialty: employee.specialty,
      status: employee.status,
      started_at: employee.created_at,
      compensation_configured: false,
      compensation_note: "Earnings are recorded from completed service performer snapshots.",
    },
    work,
    finance,
    documents: includeSensitive
      ? {
          has_identity_evidence: employee.has_identity_evidence,
          national_id_number: employee.national_id_number,
          id_document_front_url: employee.id_document_front_url,
          id_document_back_url: employee.id_document_back_url,
          id_document_pdf_url: employee.id_document_pdf_url,
        }
      : null,
    activity,
  };
};

export const getEmployeeDocument = async ({ salonId, employeeId, kind }) => {
  const allowed = new Map([
    ["id-front", "id_document_front_url"],
    ["id-back", "id_document_back_url"],
    ["id-pdf", "id_document_pdf_url"],
  ]);
  const column = allowed.get(kind);
  if (!column) return null;
  const { rows } = await db.query(
    `SELECT ${column} AS document_url
     FROM users WHERE id = $1 AND salon_id = $2`,
    [employeeId, salonId],
  );
  return rows[0]?.document_url || null;
};
