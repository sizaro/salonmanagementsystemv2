import crypto from "crypto";
import db from "./database.js";
import { sha256, signatureFromDataUrl, storeReceiptPdf, storeSignaturePng } from "../utils/financeReceiptStorage.js";
import { createEmployeeFinanceReceiptPdf, receiptDocumentHash } from "../utils/employeeFinanceReceiptPdf.js";

const STAFF_ROLES = new Set(["owner", "manager", "cashier"]);
const REVIEWER_ROLES = new Set(["owner", "manager"]);
const PAYMENT_METHODS = new Set([
  "CASH",
  "MOBILE_MONEY",
  "BANK_TRANSFER",
  "OTHER",
]);
const ADVANCE_SETTLEMENT_METHODS = new Set([
  "PAYROLL_DEDUCTION",
  "CASH_REPAYMENT",
  "WAIVED",
]);

const financeError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const positiveAmount = (value, label = "Amount") => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw financeError(`${label} must be greater than zero`);
  }
  return amount;
};

const receiptNumber = (prefix) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;

const assertRole = (role, allowedRoles, message) => {
  if (!allowedRoles.has(String(role || "").toLowerCase())) {
    throw financeError(message, 403);
  }
};

const signatureDeclaration = ({ signatureType, receiptType, amount, employeeName }) => {
  if (signatureType === "APPROVAL") {
    return `I approve this ${receiptType.toLowerCase()} of UGX ${Number(amount || 0).toLocaleString("en-UG")} for ${employeeName}.`;
  }
  return `I acknowledge receiving UGX ${Number(amount || 0).toLocaleString("en-UG")} as an employee ${receiptType.toLowerCase()} under the recorded terms.`;
};

const prepareSignature = async (signatureDataUrl) => {
  const buffer = await signatureFromDataUrl(signatureDataUrl);
  return { signatureUrl: await storeSignaturePng(buffer), signatureHash: sha256(buffer) };
};

const transactionIdentity = async ({ salonId, sourceType, sourceId }) => {
  const table = sourceType === "ADVANCE" ? "employee_advance_requests" : "employee_payments";
  const amountColumn = "requested_amount";
  const { rows } = await db.query(
    `SELECT t.id, t.employee_id, t.${amountColumn} AS amount,
            u.role AS employee_role,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS employee_name
     FROM ${table} t
     JOIN users u ON u.id = t.employee_id AND u.salon_id = t.salon_id
     WHERE t.id = $1 AND t.salon_id = $2`,
    [sourceId, salonId],
  );
  if (!rows[0]) throw financeError("Finance transaction was not found", 404);
  return rows[0];
};

const insertSignature = async (client, {
  salonId, receiptId = null, advanceRequestId = null, employeePaymentId = null,
  signerId, signerRole, signatureType, signatureUrl, signatureHash, declaration,
}) => client.query(
  `INSERT INTO employee_finance_receipt_signatures (
     salon_id, receipt_id, advance_request_id, employee_payment_id,
     signer_id, signer_role, signature_type, signature_url, signature_hash, declaration
   ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
  [salonId, receiptId, advanceRequestId, employeePaymentId, signerId, signerRole, signatureType, signatureUrl, signatureHash, declaration],
);

const paymentAvailability = async (client, { salonId, employeeId, periodId }) => {
  let range = null;
  if (periodId) {
    const { rows } = await client.query(
      `SELECT id, start_date::text AS start_date, end_date::text AS end_date
       FROM employee_finance_periods
       WHERE id = $1 AND salon_id = $2`,
      [periodId, salonId],
    );
    if (!rows[0]) throw financeError("Finance period was not found", 404);
    range = rows[0];
  }

  const { rows } = await client.query(
    `SELECT
       COALESCE((
         SELECT SUM(ee.amount)
         FROM employee_earnings ee
         WHERE ee.salon_id = $1
           AND ee.employee_id = $2
           AND ($3::date IS NULL OR ee.earning_date >= $3::date)
           AND ($4::date IS NULL OR ee.earning_date <= $4::date)
       ), 0)::numeric AS earned_amount,
       COALESCE((
         SELECT SUM(ep.requested_amount)
         FROM employee_payments ep
         WHERE ep.salon_id = $1
           AND ep.employee_id = $2
           AND ep.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
           AND ($5::bigint IS NULL OR ep.financial_period_id = $5::bigint)
       ), 0)::numeric AS paid_amount,
        COALESCE((
          SELECT SUM(asl.amount)
          FROM employee_advance_settlements asl
          WHERE asl.salon_id = $1
            AND asl.employee_id = $2
            AND asl.settlement_method = 'PAYROLL_DEDUCTION'
            AND asl.workflow_status = 'EFFECTIVE'
        ), 0)::numeric AS payroll_deductions,
       COALESCE((
         SELECT SUM(GREATEST(
           ar.requested_amount - COALESCE((
             SELECT SUM(asl.amount)
             FROM employee_advance_settlements asl
             WHERE asl.salon_id = ar.salon_id
               AND asl.advance_request_id = ar.id
               AND asl.workflow_status = 'EFFECTIVE'
           ), 0),
           0
         ))
         FROM employee_advance_requests ar
         WHERE ar.salon_id = $1
           AND ar.employee_id = $2
           AND ar.workflow_status IN ('DISBURSED', 'ACKNOWLEDGED')
       ), 0)::numeric AS advance_outstanding`,
    [
      salonId,
      employeeId,
      range?.start_date || null,
      range?.end_date || null,
      periodId || null,
    ],
  );
  const earned = Number(rows[0].earned_amount || 0);
  const paid = Number(rows[0].paid_amount || 0);
  const payrollDeductions = Number(rows[0].payroll_deductions || 0);
  const advanceOutstanding = Number(rows[0].advance_outstanding || 0);
  return {
    earned,
    paid,
    payrollDeductions,
    advanceOutstanding,
    available: Math.max(earned - paid - payrollDeductions, 0),
  };
};

const mapAdvanceRequest = (row) => ({
  ...row,
  requested_amount: Number(row.requested_amount || 0),
  settled_amount: Number(row.settled_amount || 0),
  outstanding_amount: Number(row.outstanding_amount || 0),
  pending_payroll_deductions: Array.isArray(row.pending_payroll_deductions)
    ? row.pending_payroll_deductions.map((item) => ({ ...item, amount: Number(item.amount || 0) }))
    : [],
});

const mapPayment = (row) => ({
  ...row,
  requested_amount: Number(row.requested_amount || 0),
});

const listBase = `
  SELECT
    ar.*,
    TRIM(CONCAT(COALESCE(employee.first_name, ''), ' ', COALESCE(employee.last_name, ''))) AS employee_name,
    TRIM(CONCAT(COALESCE(requester.first_name, ''), ' ', COALESCE(requester.last_name, ''))) AS requested_by_name,
    TRIM(CONCAT(COALESCE(reviewer.first_name, ''), ' ', COALESCE(reviewer.last_name, ''))) AS reviewed_by_name,
    COALESCE((
      SELECT SUM(asl.amount)
      FROM employee_advance_settlements asl
      WHERE asl.advance_request_id = ar.id
        AND asl.salon_id = ar.salon_id
        AND asl.workflow_status = 'EFFECTIVE'
    ), 0)::numeric AS settled_amount,
    GREATEST(ar.requested_amount - COALESCE((
      SELECT SUM(asl.amount)
      FROM employee_advance_settlements asl
      WHERE asl.advance_request_id = ar.id
        AND asl.salon_id = ar.salon_id
        AND asl.workflow_status = 'EFFECTIVE'
    ), 0), 0)::numeric AS outstanding_amount
    , COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pending.id,
        'amount', pending.amount,
        'notes', pending.notes,
        'receipt_number', pending.receipt_number,
        'created_at', pending.created_at
      ) ORDER BY pending.created_at ASC)
      FROM employee_advance_settlements pending
      WHERE pending.advance_request_id = ar.id
        AND pending.salon_id = ar.salon_id
        AND pending.settlement_method = 'PAYROLL_DEDUCTION'
        AND pending.workflow_status = 'PENDING_EMPLOYEE_CONSENT'
    ), '[]'::jsonb) AS pending_payroll_deductions
  FROM employee_advance_requests ar
  JOIN users employee ON employee.id = ar.employee_id AND employee.salon_id = ar.salon_id
  JOIN users requester ON requester.id = ar.requested_by AND requester.salon_id = ar.salon_id
  LEFT JOIN users reviewer ON reviewer.id = ar.reviewed_by AND reviewer.salon_id = ar.salon_id
`;

export const createAdvanceRequest = async ({
  salonId,
  actorId,
  actorRole,
  employeeId,
  amount,
  reason,
}) => {
  const targetEmployeeId = Number(employeeId || actorId);
  if (!Number.isInteger(targetEmployeeId) || targetEmployeeId <= 0) {
    throw financeError("A valid employee is required");
  }
  if (targetEmployeeId !== Number(actorId)) {
    assertRole(actorRole, STAFF_ROLES, "You may only request an advance for yourself");
  }

  const requestedAmount = positiveAmount(amount, "Advance amount");
  const { rows } = await db.query(
    `INSERT INTO employee_advance_requests (
       salon_id, employee_id, requested_amount, reason, requested_by
     )
     SELECT $1, u.id, $3, $4, $5
     FROM users u
     WHERE u.id = $2 AND u.salon_id = $1
     RETURNING *`,
    [salonId, targetEmployeeId, requestedAmount, String(reason || "").trim() || null, actorId],
  );
  if (!rows[0]) throw financeError("Employee was not found in this salon", 404);
  return mapAdvanceRequest(rows[0]);
};

export const listAdvanceRequests = async ({ salonId, actorId, actorRole }) => {
  const isStaff = STAFF_ROLES.has(String(actorRole || "").toLowerCase());
  const { rows } = await db.query(
    `${listBase}
     WHERE ar.salon_id = $1
       AND ($2::boolean = TRUE OR ar.employee_id = $3)
     ORDER BY ar.created_at DESC, ar.id DESC`,
    [salonId, isStaff, actorId],
  );
  return rows.map(mapAdvanceRequest);
};

export const decideAdvanceRequest = async ({
  salonId,
  actorId,
  actorRole,
  requestId,
  approved,
  rejectionReason,
  signatureDataUrl,
}) => {
  assertRole(actorRole, REVIEWER_ROLES, "Only an owner or manager may review advance requests");
  if (!approved && !String(rejectionReason || "").trim()) {
    throw financeError("A rejection reason is required");
  }
  const identity = await transactionIdentity({ salonId, sourceType: "ADVANCE", sourceId: requestId });
  if (Number(identity.employee_id) === Number(actorId)) {
    throw financeError("You cannot approve your own advance request", 403);
  }
  if (String(identity.employee_role || "").toLowerCase() === "manager"
    && String(actorRole || "").toLowerCase() !== "owner") {
    throw financeError("A manager's advance request must be approved by the owner", 403);
  }
  const signature = approved ? await prepareSignature(signatureDataUrl) : null;
  const nextStatus = approved ? "APPROVED" : "REJECTED";
  return db.transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE employee_advance_requests
     SET workflow_status = $1::varchar,
         reviewed_by = $2,
         reviewed_at = NOW(),
         rejection_reason = CASE WHEN $1::varchar = 'REJECTED' THEN $3::varchar ELSE NULL END,
         updated_at = NOW()
     WHERE id = $4 AND salon_id = $5 AND workflow_status = 'REQUESTED'
     RETURNING *`,
      [nextStatus, actorId, String(rejectionReason || "").trim() || null, requestId, salonId],
    );
    if (!rows[0]) throw financeError("Advance request is unavailable for review", 409);
    if (signature) {
      await insertSignature(client, {
        salonId,
        advanceRequestId: requestId,
        signerId: actorId,
        signerRole: String(actorRole || "").toLowerCase(),
        signatureType: "APPROVAL",
        ...signature,
        declaration: signatureDeclaration({ signatureType: "APPROVAL", receiptType: "ADVANCE", amount: identity.amount, employeeName: identity.employee_name }),
      });
    }
    return mapAdvanceRequest(rows[0]);
  });
};

export const disburseAdvanceRequest = async ({
  salonId,
  actorId,
  actorRole,
  requestId,
}) => {
  assertRole(actorRole, STAFF_ROLES, "Only salon finance staff may disburse an advance");
  return db.transaction(async (client) => {
    const { rows: requestRows } = await client.query(
      `SELECT * FROM employee_advance_requests
       WHERE id = $1 AND salon_id = $2
       FOR UPDATE`,
      [requestId, salonId],
    );
    const request = requestRows[0];
    if (!request || request.workflow_status !== "APPROVED") {
      throw financeError("Only an approved advance request can be disbursed", 409);
    }

    const { rows: advanceRows } = await client.query(
      `INSERT INTO advances (
         employee_id, amount, description, salon_id,
         advance_date, advance_time, entry_type, backdate_reason, created_at
       ) VALUES (
         $1, $2, $3, $4,
         (NOW() AT TIME ZONE 'Africa/Kampala')::date,
         (NOW() AT TIME ZONE 'Africa/Kampala')::time,
         'current', NULL, NOW()
       ) RETURNING id`,
      [
        request.employee_id,
        request.requested_amount,
        request.reason || "Approved employee advance request",
        salonId,
      ],
    );
    const receipt = receiptNumber("ADV");
    const { rows: updatedRows } = await client.query(
      `UPDATE employee_advance_requests
       SET workflow_status = 'DISBURSED',
           advance_id = $1,
           disbursed_by = $2,
           disbursed_at = NOW(),
           receipt_number = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [advanceRows[0].id, actorId, receipt, requestId],
    );
    await client.query(
      `INSERT INTO employee_finance_receipts (
         salon_id, employee_id, receipt_number, receipt_type,
         advance_request_id, amount, issued_by
       ) VALUES ($1, $2, $3, 'ADVANCE', $4, $5, $6)`,
      [salonId, request.employee_id, receipt, requestId, request.requested_amount, actorId],
    );
    return mapAdvanceRequest(updatedRows[0]);
  });
};

export const acknowledgeAdvanceRequest = async ({ salonId, actorId, requestId, signatureDataUrl }) => {
  const identity = await transactionIdentity({ salonId, sourceType: "ADVANCE", sourceId: requestId });
  if (Number(identity.employee_id) !== Number(actorId)) throw financeError("Only the receiving employee may acknowledge this receipt", 403);
  const signature = await prepareSignature(signatureDataUrl);
  const result = await db.transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE employee_advance_requests
     SET workflow_status = 'ACKNOWLEDGED',
         acknowledged_by = $1,
         acknowledged_at = NOW(),
         updated_at = NOW()
     WHERE id = $2 AND salon_id = $3 AND employee_id = $1
       AND workflow_status = 'DISBURSED'
     RETURNING *`,
      [actorId, requestId, salonId],
    );
    if (!rows[0]) throw financeError("Advance is unavailable for acknowledgement", 409);
    const receiptResult = await client.query(
      `UPDATE employee_finance_receipts
       SET acknowledged_by = $1, acknowledged_at = NOW()
       WHERE salon_id = $2 AND advance_request_id = $3 AND acknowledged_at IS NULL
       RETURNING id`,
      [actorId, salonId, requestId],
    );
    const receipt = receiptResult.rows[0];
    if (!receipt) throw financeError("Advance receipt is unavailable for acknowledgement", 409);
    await insertSignature(client, {
      salonId,
      receiptId: receipt.id,
      advanceRequestId: requestId,
      signerId: actorId,
      signerRole: "employee",
      signatureType: "ACKNOWLEDGEMENT",
      ...signature,
      declaration: signatureDeclaration({ signatureType: "ACKNOWLEDGEMENT", receiptType: "ADVANCE", amount: identity.amount, employeeName: identity.employee_name }),
    });
    return { request: mapAdvanceRequest(rows[0]), receiptId: receipt.id };
  });
  await finaliseReceipt({ salonId, receiptId: result.receiptId });
  return result.request;
};

export const settleAdvanceRequest = async ({
  salonId,
  actorId,
  actorRole,
  requestId,
  amount,
  settlementMethod,
  notes,
}) => {
  assertRole(actorRole, REVIEWER_ROLES, "Only an owner or manager may settle an advance");
  const requestedAmount = positiveAmount(amount, "Settlement amount");
  const method = String(settlementMethod || "").trim().toUpperCase();
  if (!ADVANCE_SETTLEMENT_METHODS.has(method)) {
    throw financeError("Choose payroll deduction, cash repayment, or waiver");
  }
  if (method === "WAIVED" && String(actorRole || "").toLowerCase() !== "owner") {
    throw financeError("Only the owner may waive an employee advance", 403);
  }

  return db.transaction(async (client) => {
    const { rows: advanceRows } = await client.query(
      `SELECT *
       FROM employee_advance_requests
       WHERE id = $1 AND salon_id = $2
       FOR UPDATE`,
      [requestId, salonId],
    );
    const advance = advanceRows[0];
    if (!advance || !["DISBURSED", "ACKNOWLEDGED"].includes(advance.workflow_status)) {
      throw financeError("Only a disbursed advance can be settled", 409);
    }

    const { rows: settledRows } = await client.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS settled_amount
       FROM employee_advance_settlements
       WHERE advance_request_id = $1 AND salon_id = $2
         AND workflow_status = 'EFFECTIVE'`,
      [requestId, salonId],
    );
    const outstanding = Math.max(
      Number(advance.requested_amount) - Number(settledRows[0].settled_amount || 0),
      0,
    );
    if (requestedAmount > outstanding) {
      throw financeError(`Settlement exceeds the outstanding advance of ${outstanding.toLocaleString()} UGX`);
    }

    const receipt = receiptNumber("ADVSET");
    const { rows } = await client.query(
      `INSERT INTO employee_advance_settlements (
         salon_id, advance_request_id, employee_id, amount,
         settlement_method, notes, receipt_number, settled_by, workflow_status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        salonId,
        requestId,
        advance.employee_id,
        requestedAmount,
        method,
        String(notes || "").trim() || null,
        receipt,
        actorId,
        method === "PAYROLL_DEDUCTION" ? "PENDING_EMPLOYEE_CONSENT" : "EFFECTIVE",
      ],
    );
    return {
      ...rows[0],
      amount: Number(rows[0].amount || 0),
      requires_employee_consent: method === "PAYROLL_DEDUCTION",
    };
  });
};

export const acknowledgeAdvanceSettlement = async ({
  salonId,
  actorId,
  requestId,
  settlementId,
  signatureDataUrl,
}) => {
  const signature = await prepareSignature(signatureDataUrl);
  return db.transaction(async (client) => {
    const { rows: settlementRows } = await client.query(
      `SELECT asl.*, ar.workflow_status AS advance_workflow_status,
              TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS employee_name
       FROM employee_advance_settlements asl
       JOIN employee_advance_requests ar
         ON ar.id = asl.advance_request_id AND ar.salon_id = asl.salon_id
       JOIN users u ON u.id = asl.employee_id AND u.salon_id = asl.salon_id
       WHERE asl.id = $1
         AND asl.advance_request_id = $2
         AND asl.salon_id = $3
       FOR UPDATE`,
      [settlementId, requestId, salonId],
    );
    const settlement = settlementRows[0];
    if (!settlement || Number(settlement.employee_id) !== Number(actorId)) {
      throw financeError("Only the receiving employee may consent to this payroll deduction", 403);
    }
    if (settlement.settlement_method !== "PAYROLL_DEDUCTION"
      || settlement.workflow_status !== "PENDING_EMPLOYEE_CONSENT") {
      throw financeError("This payroll deduction is unavailable for employee consent", 409);
    }
    if (!["DISBURSED", "ACKNOWLEDGED"].includes(settlement.advance_workflow_status)) {
      throw financeError("The linked advance is unavailable for settlement", 409);
    }

    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `employee-payroll-deduction:${salonId}:${settlement.employee_id}`,
    ]);

    const availability = await paymentAvailability(client, {
      salonId,
      employeeId: settlement.employee_id,
      periodId: null,
    });
    if (Number(settlement.amount) > availability.available) {
      throw financeError(`Deduction exceeds available earnings of ${availability.available.toLocaleString()} UGX`);
    }

    const { rows: outstandingRows } = await client.query(
      `SELECT GREATEST(ar.requested_amount - COALESCE(SUM(effective.amount), 0), 0)::numeric AS outstanding_amount
       FROM employee_advance_requests ar
       LEFT JOIN employee_advance_settlements effective
         ON effective.advance_request_id = ar.id
        AND effective.salon_id = ar.salon_id
        AND effective.workflow_status = 'EFFECTIVE'
       WHERE ar.id = $1 AND ar.salon_id = $2
       GROUP BY ar.requested_amount`,
      [requestId, salonId],
    );
    const outstanding = Number(outstandingRows[0]?.outstanding_amount || 0);
    if (Number(settlement.amount) > outstanding) {
      throw financeError(`Deduction exceeds the outstanding advance of ${outstanding.toLocaleString()} UGX`);
    }

    const declaration = `I agree that UGX ${Number(settlement.amount).toLocaleString("en-UG")} will be deducted from my earned salary to settle advance ${settlement.receipt_number}.`;
    const { rows } = await client.query(
      `UPDATE employee_advance_settlements
       SET workflow_status = 'EFFECTIVE',
           employee_consented_by = $1,
           employee_consented_at = NOW(),
           employee_consent_signature_url = $2,
           employee_consent_signature_hash = $3,
           employee_consent_declaration = $4
       WHERE id = $5
         AND salon_id = $6
         AND workflow_status = 'PENDING_EMPLOYEE_CONSENT'
       RETURNING *`,
      [actorId, signature.signatureUrl, signature.signatureHash, declaration, settlementId, salonId],
    );
    if (!rows[0]) throw financeError("This payroll deduction was already processed", 409);
    return { ...rows[0], amount: Number(rows[0].amount || 0) };
  });
};

const paymentBase = `
  SELECT
    ep.*,
    efp.name AS period_name,
    efp.start_date::text AS period_start_date,
    efp.end_date::text AS period_end_date,
    TRIM(CONCAT(COALESCE(employee.first_name, ''), ' ', COALESCE(employee.last_name, ''))) AS employee_name,
    TRIM(CONCAT(COALESCE(requester.first_name, ''), ' ', COALESCE(requester.last_name, ''))) AS requested_by_name
  FROM employee_payments ep
  JOIN users employee ON employee.id = ep.employee_id AND employee.salon_id = ep.salon_id
  JOIN users requester ON requester.id = ep.requested_by AND requester.salon_id = ep.salon_id
  LEFT JOIN employee_finance_periods efp ON efp.id = ep.financial_period_id AND efp.salon_id = ep.salon_id
`;

export const createEmployeePayment = async ({
  salonId,
  actorId,
  actorRole,
  employeeId,
  periodId,
  amount,
  paymentMethod,
  paymentReference,
  notes,
}) => {
  assertRole(actorRole, STAFF_ROLES, "Only salon finance staff may prepare a payment");
  const targetEmployeeId = Number(employeeId);
  if (!Number.isInteger(targetEmployeeId) || targetEmployeeId <= 0) {
    throw financeError("A valid employee is required");
  }
  const requestedAmount = positiveAmount(amount, "Payment amount");
  const method = String(paymentMethod || "CASH").trim().toUpperCase();
  if (!PAYMENT_METHODS.has(method)) throw financeError("Invalid payment method");

  return db.transaction(async (client) => {
    const { rows: employeeRows } = await client.query(
      `SELECT id FROM users WHERE id = $1 AND salon_id = $2 FOR KEY SHARE`,
      [targetEmployeeId, salonId],
    );
    if (!employeeRows[0]) throw financeError("Employee was not found in this salon", 404);
    const availability = await paymentAvailability(client, {
      salonId,
      employeeId: targetEmployeeId,
      periodId: periodId ? Number(periodId) : null,
    });
    if (requestedAmount > availability.available) {
      throw financeError(
        `Payment exceeds available earnings of ${availability.available.toLocaleString()} UGX`,
      );
    }
    const { rows } = await client.query(
      `INSERT INTO employee_payments (
         salon_id, employee_id, financial_period_id, requested_amount,
         payment_method, payment_reference, notes, requested_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        salonId,
        targetEmployeeId,
        periodId ? Number(periodId) : null,
        requestedAmount,
        method,
        String(paymentReference || "").trim() || null,
        String(notes || "").trim() || null,
        actorId,
      ],
    );
    return mapPayment(rows[0]);
  });
};

export const listEmployeePayments = async ({ salonId, actorId, actorRole }) => {
  const isStaff = STAFF_ROLES.has(String(actorRole || "").toLowerCase());
  const { rows } = await db.query(
    `${paymentBase}
     WHERE ep.salon_id = $1
       AND ($2::boolean = TRUE OR ep.employee_id = $3)
     ORDER BY ep.created_at DESC, ep.id DESC`,
    [salonId, isStaff, actorId],
  );
  return rows.map(mapPayment);
};

export const decideEmployeePayment = async ({
  salonId,
  actorId,
  actorRole,
  paymentId,
  approved,
  rejectionReason,
  signatureDataUrl,
}) => {
  assertRole(actorRole, REVIEWER_ROLES, "Only an owner or manager may review payments");
  if (!approved && !String(rejectionReason || "").trim()) {
    throw financeError("A rejection reason is required");
  }
  const identity = await transactionIdentity({ salonId, sourceType: "PAYMENT", sourceId: paymentId });
  if (Number(identity.employee_id) === Number(actorId)) {
    throw financeError("You cannot approve your own payment request", 403);
  }
  const signature = approved ? await prepareSignature(signatureDataUrl) : null;
  return db.transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE employee_payments
     SET workflow_status = $1::varchar,
         approved_by = $2,
         approved_at = NOW(),
         rejection_reason = CASE WHEN $1::varchar = 'REJECTED' THEN $3::varchar ELSE NULL END,
         updated_at = NOW()
     WHERE id = $4 AND salon_id = $5 AND workflow_status = 'REQUESTED'
     RETURNING *`,
      [approved ? "APPROVED" : "REJECTED", actorId, String(rejectionReason || "").trim() || null, paymentId, salonId],
    );
    if (!rows[0]) throw financeError("Payment is unavailable for review", 409);
    if (signature) {
      await insertSignature(client, {
        salonId,
        employeePaymentId: paymentId,
        signerId: actorId,
        signerRole: String(actorRole || "").toLowerCase(),
        signatureType: "APPROVAL",
        ...signature,
        declaration: signatureDeclaration({ signatureType: "APPROVAL", receiptType: "PAYMENT", amount: identity.amount, employeeName: identity.employee_name }),
      });
    }
    return mapPayment(rows[0]);
  });
};

export const disburseEmployeePayment = async ({ salonId, actorId, actorRole, paymentId }) => {
  assertRole(actorRole, STAFF_ROLES, "Only salon finance staff may disburse a payment");
  return db.transaction(async (client) => {
    const { rows: paymentRows } = await client.query(
      `SELECT * FROM employee_payments
       WHERE id = $1 AND salon_id = $2
       FOR UPDATE`,
      [paymentId, salonId],
    );
    const payment = paymentRows[0];
    if (!payment || payment.workflow_status !== "APPROVED") {
      throw financeError("Only an approved payment can be disbursed", 409);
    }
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `employee-payment:${salonId}:${payment.employee_id}:${payment.financial_period_id || "all"}`,
    ]);
    const availability = await paymentAvailability(client, {
      salonId,
      employeeId: payment.employee_id,
      periodId: payment.financial_period_id,
    });
    if (Number(payment.requested_amount) > availability.available) {
      throw financeError("Payment now exceeds available earnings and needs a new review", 409);
    }
    const receipt = receiptNumber("PAY");
    const { rows: updatedRows } = await client.query(
      `UPDATE employee_payments
       SET workflow_status = 'DISBURSED',
           disbursed_by = $1,
           disbursed_at = NOW(),
           receipt_number = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [actorId, receipt, paymentId],
    );
    await client.query(
      `INSERT INTO employee_finance_receipts (
         salon_id, employee_id, receipt_number, receipt_type,
         employee_payment_id, amount, issued_by
       ) VALUES ($1, $2, $3, 'PAYMENT', $4, $5, $6)`,
      [salonId, payment.employee_id, receipt, paymentId, payment.requested_amount, actorId],
    );
    return mapPayment(updatedRows[0]);
  });
};

export const acknowledgeEmployeePayment = async ({ salonId, actorId, paymentId, signatureDataUrl }) => {
  const identity = await transactionIdentity({ salonId, sourceType: "PAYMENT", sourceId: paymentId });
  if (Number(identity.employee_id) !== Number(actorId)) throw financeError("Only the receiving employee may acknowledge this receipt", 403);
  const signature = await prepareSignature(signatureDataUrl);
  const result = await db.transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE employee_payments
     SET workflow_status = 'ACKNOWLEDGED',
         acknowledged_by = $1,
         acknowledged_at = NOW(),
         updated_at = NOW()
     WHERE id = $2 AND salon_id = $3 AND employee_id = $1
       AND workflow_status = 'DISBURSED'
     RETURNING *`,
      [actorId, paymentId, salonId],
    );
    if (!rows[0]) throw financeError("Payment is unavailable for acknowledgement", 409);
    const receiptResult = await client.query(
      `UPDATE employee_finance_receipts
       SET acknowledged_by = $1, acknowledged_at = NOW()
       WHERE salon_id = $2 AND employee_payment_id = $3 AND acknowledged_at IS NULL
       RETURNING id`,
      [actorId, salonId, paymentId],
    );
    const receipt = receiptResult.rows[0];
    if (!receipt) throw financeError("Payment receipt is unavailable for acknowledgement", 409);
    await insertSignature(client, {
      salonId,
      receiptId: receipt.id,
      employeePaymentId: paymentId,
      signerId: actorId,
      signerRole: "employee",
      signatureType: "ACKNOWLEDGEMENT",
      ...signature,
      declaration: signatureDeclaration({ signatureType: "ACKNOWLEDGEMENT", receiptType: "PAYMENT", amount: identity.amount, employeeName: identity.employee_name }),
    });
    return { payment: mapPayment(rows[0]), receiptId: receipt.id };
  });
  await finaliseReceipt({ salonId, receiptId: result.receiptId });
  return result.payment;
};

const loadReceiptDetail = async ({ salonId, receiptId }) => {
  const { rows } = await db.query(
    `SELECT
       r.id, r.salon_id, r.employee_id, r.receipt_number, r.receipt_type,
       r.amount, r.issued_at, r.acknowledged_at, r.pdf_url, r.document_hash,
       r.finalized_at, r.document_version, r.advance_request_id, r.employee_payment_id,
       s.name AS salon_name, s.phone AS salon_phone, s.email AS salon_email,
       TRIM(CONCAT(COALESCE(employee.first_name, ''), ' ', COALESCE(employee.last_name, ''))) AS employee_name,
       TRIM(CONCAT(COALESCE(issuer.first_name, ''), ' ', COALESCE(issuer.last_name, ''))) AS issued_by_name,
       COALESCE(ar.reason, ep.notes) AS notes_or_reason,
       ar.reason AS reason,
       ar.disbursed_at AS advance_disbursed_at,
       ep.disbursed_at AS payment_disbursed_at,
       ep.payment_method, ep.payment_reference,
       TRIM(CONCAT(COALESCE(disburser_advance.first_name, disburser_payment.first_name, ''), ' ', COALESCE(disburser_advance.last_name, disburser_payment.last_name, ''))) AS disbursed_by_name
     FROM employee_finance_receipts r
     JOIN salons s ON s.id = r.salon_id
     JOIN users employee ON employee.id = r.employee_id AND employee.salon_id = r.salon_id
     LEFT JOIN users issuer ON issuer.id = r.issued_by AND issuer.salon_id = r.salon_id
     LEFT JOIN employee_advance_requests ar ON ar.id = r.advance_request_id AND ar.salon_id = r.salon_id
     LEFT JOIN employee_payments ep ON ep.id = r.employee_payment_id AND ep.salon_id = r.salon_id
     LEFT JOIN users disburser_advance ON disburser_advance.id = ar.disbursed_by AND disburser_advance.salon_id = r.salon_id
     LEFT JOIN users disburser_payment ON disburser_payment.id = ep.disbursed_by AND disburser_payment.salon_id = r.salon_id
     WHERE r.id = $1 AND r.salon_id = $2`,
    [receiptId, salonId],
  );
  const receipt = rows[0];
  if (!receipt) throw financeError("Receipt was not found", 404);
  const signatureResult = await db.query(
    `SELECT rs.id, rs.signature_type, rs.signature_url, rs.signature_hash,
            rs.declaration, rs.signed_at, rs.signer_role,
            TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS signer_name
     FROM employee_finance_receipt_signatures rs
     JOIN users u ON u.id = rs.signer_id AND u.salon_id = rs.salon_id
     WHERE rs.salon_id = $1
       AND (rs.receipt_id = $2 OR (rs.receipt_id IS NULL AND (
         rs.advance_request_id = $3 OR rs.employee_payment_id = $4
       )))
     ORDER BY rs.signed_at ASC, rs.id ASC`,
    [salonId, receiptId, receipt.advance_request_id, receipt.employee_payment_id],
  );
  return {
    receipt: { ...receipt, amount: Number(receipt.amount || 0) },
    salon: { name: receipt.salon_name, phone: receipt.salon_phone, email: receipt.salon_email },
    transaction: {
      employee_name: receipt.employee_name,
      reason: receipt.reason,
      notes: receipt.notes_or_reason,
      payment_method: receipt.payment_method || "CASH",
      payment_reference: receipt.payment_reference,
      disbursed_at: receipt.advance_disbursed_at || receipt.payment_disbursed_at || receipt.issued_at,
      disbursed_by_name: receipt.disbursed_by_name,
      issued_by_name: receipt.issued_by_name,
    },
    signatures: signatureResult.rows,
  };
};

const finaliseReceipt = async ({ salonId, receiptId }) => {
  const existing = await loadReceiptDetail({ salonId, receiptId });
  if (existing.receipt.pdf_url) return existing;
  const hasApproval = existing.signatures.some((item) => item.signature_type === "APPROVAL");
  const hasAcknowledgement = existing.signatures.some((item) => item.signature_type === "ACKNOWLEDGEMENT");
  if (!hasApproval || !hasAcknowledgement) {
    // Receipts issued before signature evidence existed remain historically
    // correct, but must never be represented as newly signed documents.
    return existing;
  }
  const pdf = await createEmployeeFinanceReceiptPdf(existing);
  const hash = receiptDocumentHash(pdf);
  const pdfUrl = await storeReceiptPdf(pdf);
  const { rows } = await db.query(
    `UPDATE employee_finance_receipts
     SET pdf_url = $1, document_hash = $2, finalized_at = NOW()
     WHERE id = $3 AND salon_id = $4 AND pdf_url IS NULL
     RETURNING id`,
    [pdfUrl, hash, receiptId, salonId],
  );
  if (!rows[0]) return loadReceiptDetail({ salonId, receiptId });
  return loadReceiptDetail({ salonId, receiptId });
};

export const getEmployeeFinanceReceiptDetail = async ({ salonId, actorId, actorRole, receiptId }) => {
  const detail = await loadReceiptDetail({ salonId, receiptId });
  const isStaff = STAFF_ROLES.has(String(actorRole || "").toLowerCase());
  if (!isStaff && Number(detail.receipt.employee_id) !== Number(actorId)) {
    throw financeError("You are not allowed to view this receipt", 403);
  }
  return {
    ...detail,
    receipt: {
      ...detail.receipt,
      pdf_available: Boolean(detail.receipt.pdf_url),
      pdf_url: undefined,
    },
    signatures: detail.signatures.map(({ signature_url: _privateReference, ...signature }) => ({
      ...signature,
      signature_asset_url: `/api/employee-finance/receipts/${receiptId}/signatures/${signature.id}`,
    })),
  };
};

export const getEmployeeFinanceReceiptSignature = async ({ salonId, actorId, actorRole, receiptId, signatureId }) => {
  await getEmployeeFinanceReceiptDetail({ salonId, actorId, actorRole, receiptId });
  const { rows } = await db.query(
    `SELECT rs.signature_url
     FROM employee_finance_receipt_signatures rs
     JOIN employee_finance_receipts r ON r.salon_id = rs.salon_id
       AND (rs.receipt_id = r.id OR rs.advance_request_id = r.advance_request_id OR rs.employee_payment_id = r.employee_payment_id)
     WHERE r.id = $1 AND r.salon_id = $2 AND rs.id = $3`,
    [receiptId, salonId, signatureId],
  );
  if (!rows[0]?.signature_url) throw financeError("Signature evidence was not found", 404);
  return rows[0].signature_url;
};

export const getEmployeeFinanceReceipts = async ({ salonId, actorId, actorRole }) => {
  const isStaff = STAFF_ROLES.has(String(actorRole || "").toLowerCase());
  const { rows } = await db.query(
    `SELECT * FROM (
       SELECT
         r.id, r.salon_id, r.employee_id, r.receipt_number, r.receipt_type,
         r.amount, r.issued_by, r.issued_at, r.acknowledged_by, r.acknowledged_at,
         r.pdf_url, r.finalized_at,
         EXISTS(SELECT 1 FROM employee_finance_receipt_signatures rs WHERE rs.receipt_id = r.id AND rs.signature_type = 'ACKNOWLEDGEMENT') AS has_employee_signature,
         EXISTS(SELECT 1 FROM employee_finance_receipt_signatures rs WHERE (rs.receipt_id = r.id OR rs.advance_request_id = r.advance_request_id OR rs.employee_payment_id = r.employee_payment_id) AND rs.signature_type = 'APPROVAL') AS has_management_signature,
         TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS employee_name
       FROM employee_finance_receipts r
       JOIN users u ON u.id = r.employee_id AND u.salon_id = r.salon_id
       WHERE r.salon_id = $1
         AND ($2::boolean = TRUE OR r.employee_id = $3)
       UNION ALL
       SELECT
         asl.id, asl.salon_id, asl.employee_id, asl.receipt_number,
         'ADVANCE_SETTLEMENT'::varchar AS receipt_type,
         asl.amount, asl.settled_by AS issued_by, asl.settled_at AS issued_at,
         NULL::integer AS acknowledged_by, NULL::timestamptz AS acknowledged_at,
         NULL::text AS pdf_url, NULL::timestamptz AS finalized_at,
         FALSE AS has_employee_signature, FALSE AS has_management_signature,
         TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS employee_name
       FROM employee_advance_settlements asl
       JOIN users u ON u.id = asl.employee_id AND u.salon_id = asl.salon_id
       WHERE asl.salon_id = $1
         AND asl.workflow_status = 'EFFECTIVE'
         AND ($2::boolean = TRUE OR asl.employee_id = $3)
     ) receipts
     ORDER BY issued_at DESC, id DESC`,
    [salonId, isStaff, actorId],
  );
  return rows.map(({ pdf_url, ...row }) => ({ ...row, amount: Number(row.amount || 0), pdf_available: Boolean(pdf_url) }));
};
