import crypto from "crypto";
import db from "./database.js";

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
       ), 0)::numeric AS payroll_deductions`,
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
  return {
    earned,
    paid,
    payrollDeductions,
    available: Math.max(earned - paid - payrollDeductions, 0),
  };
};

const mapAdvanceRequest = (row) => ({
  ...row,
  requested_amount: Number(row.requested_amount || 0),
  settled_amount: Number(row.settled_amount || 0),
  outstanding_amount: Number(row.outstanding_amount || 0),
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
    ), 0)::numeric AS settled_amount,
    GREATEST(ar.requested_amount - COALESCE((
      SELECT SUM(asl.amount)
      FROM employee_advance_settlements asl
      WHERE asl.advance_request_id = ar.id
        AND asl.salon_id = ar.salon_id
    ), 0), 0)::numeric AS outstanding_amount
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
}) => {
  assertRole(actorRole, REVIEWER_ROLES, "Only an owner or manager may review advance requests");
  if (!approved && !String(rejectionReason || "").trim()) {
    throw financeError("A rejection reason is required");
  }
  const nextStatus = approved ? "APPROVED" : "REJECTED";
  const { rows } = await db.query(
    `UPDATE employee_advance_requests
     SET workflow_status = $1,
         reviewed_by = $2,
         reviewed_at = NOW(),
         rejection_reason = CASE WHEN $1 = 'REJECTED' THEN $3 ELSE NULL END,
         updated_at = NOW()
     WHERE id = $4 AND salon_id = $5 AND workflow_status = 'REQUESTED'
     RETURNING *`,
    [nextStatus, actorId, String(rejectionReason || "").trim() || null, requestId, salonId],
  );
  if (!rows[0]) throw financeError("Advance request is unavailable for review", 409);
  return mapAdvanceRequest(rows[0]);
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

export const acknowledgeAdvanceRequest = async ({ salonId, actorId, requestId }) => {
  const { rows } = await db.query(
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
  await db.query(
    `UPDATE employee_finance_receipts
     SET acknowledged_by = $1, acknowledged_at = NOW()
     WHERE salon_id = $2 AND advance_request_id = $3 AND acknowledged_at IS NULL`,
    [actorId, salonId, requestId],
  );
  return mapAdvanceRequest(rows[0]);
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
       WHERE advance_request_id = $1 AND salon_id = $2`,
      [requestId, salonId],
    );
    const outstanding = Math.max(
      Number(advance.requested_amount) - Number(settledRows[0].settled_amount || 0),
      0,
    );
    if (requestedAmount > outstanding) {
      throw financeError(`Settlement exceeds the outstanding advance of ${outstanding.toLocaleString()} UGX`);
    }

    if (method === "PAYROLL_DEDUCTION") {
      const availability = await paymentAvailability(client, {
        salonId,
        employeeId: advance.employee_id,
        periodId: null,
      });
      if (requestedAmount > availability.available) {
        throw financeError(`Deduction exceeds available earnings of ${availability.available.toLocaleString()} UGX`);
      }
    }

    const receipt = receiptNumber("ADVSET");
    const { rows } = await client.query(
      `INSERT INTO employee_advance_settlements (
         salon_id, advance_request_id, employee_id, amount,
         settlement_method, notes, receipt_number, settled_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      ],
    );
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
}) => {
  assertRole(actorRole, REVIEWER_ROLES, "Only an owner or manager may review payments");
  if (!approved && !String(rejectionReason || "").trim()) {
    throw financeError("A rejection reason is required");
  }
  const { rows } = await db.query(
    `UPDATE employee_payments
     SET workflow_status = $1,
         approved_by = $2,
         approved_at = NOW(),
         rejection_reason = CASE WHEN $1 = 'REJECTED' THEN $3 ELSE NULL END,
         updated_at = NOW()
     WHERE id = $4 AND salon_id = $5 AND workflow_status = 'REQUESTED'
     RETURNING *`,
    [approved ? "APPROVED" : "REJECTED", actorId, String(rejectionReason || "").trim() || null, paymentId, salonId],
  );
  if (!rows[0]) throw financeError("Payment is unavailable for review", 409);
  return mapPayment(rows[0]);
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

export const acknowledgeEmployeePayment = async ({ salonId, actorId, paymentId }) => {
  const { rows } = await db.query(
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
  await db.query(
    `UPDATE employee_finance_receipts
     SET acknowledged_by = $1, acknowledged_at = NOW()
     WHERE salon_id = $2 AND employee_payment_id = $3 AND acknowledged_at IS NULL`,
    [actorId, salonId, paymentId],
  );
  return mapPayment(rows[0]);
};

export const getEmployeeFinanceReceipts = async ({ salonId, actorId, actorRole }) => {
  const isStaff = STAFF_ROLES.has(String(actorRole || "").toLowerCase());
  const { rows } = await db.query(
    `SELECT * FROM (
       SELECT
         r.id, r.salon_id, r.employee_id, r.receipt_number, r.receipt_type,
         r.amount, r.issued_by, r.issued_at, r.acknowledged_by, r.acknowledged_at,
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
         TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS employee_name
       FROM employee_advance_settlements asl
       JOIN users u ON u.id = asl.employee_id AND u.salon_id = asl.salon_id
       WHERE asl.salon_id = $1
         AND ($2::boolean = TRUE OR asl.employee_id = $3)
     ) receipts
     ORDER BY issued_at DESC, id DESC`,
    [salonId, isStaff, actorId],
  );
  return rows.map((row) => ({ ...row, amount: Number(row.amount || 0) }));
};
