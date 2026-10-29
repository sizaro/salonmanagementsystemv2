import crypto from "crypto";
import db from "../models/database.js";
import { DateTime } from "luxon";
import { isProduction } from "../config/environment.js";
import { getProviderAdapter, normalizeProvider } from "./paymentProviders.js";
import { makeBankPaymentReference, makeIntentReference } from "./paymentReferences.js";
import { appendAuditEvent } from "../models/auditModel.js";
import {
  fetchServiceTransactionById,
  saveServiceTransaction,
  updateServiceTransactionAppointmentModel,
  validateAppointmentRequestModel,
} from "../models/servicesModel.js";
import { saveExpense } from "../models/expensesModel.js";
import {
  disburseAdvanceRequest,
  disburseEmployeePayment,
  settleAdvanceRequest,
} from "../models/employeeFinanceOperationsModel.js";

const KAMPALA_ZONE = "Africa/Kampala";
const scheduledMockPayments = new Map();

const paymentError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const activeBankAccount = async (salonId) => {
  const { rows } = await db.query(
    `SELECT id, bank_name, account_name, account_number, currency, branch_name, verification_mode
     FROM salon_bank_accounts
     WHERE salon_id = $1 AND is_active = TRUE AND currency = 'UGX'
     ORDER BY id DESC LIMIT 1`,
    [salonId],
  );
  if (!rows[0]) {
    throw paymentError("An active official UGX bank account must be configured before accepting bank transfers.", 409);
  }
  return rows[0];
};

const numericAmount = (value, label = "Amount") => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw paymentError(`${label} must be greater than zero.`);
  return amount;
};

const serviceAmount = async ({ salonId, serviceDefinitionId, serviceSource }) => {
  const { rows } = await db.query(
    `SELECT service_amount, salon_amount, service_name
     FROM service_definitions
     WHERE id = $1 AND salon_id = $2`,
    [Number(serviceDefinitionId), salonId],
  );
  const definition = rows[0];
  if (!definition) throw paymentError("The selected service is unavailable.", 404);

  const fullAmount = numericAmount(definition.service_amount, "Service amount");
  if (String(serviceSource || "").toLowerCase() === "online_booking") {
    if (Number(definition.salon_amount || 0) < 500) {
      throw paymentError("This service cannot accept the online booking discount.");
    }
    return { amount: fullAmount - 500, description: definition.service_name || "Salon service" };
  }
  return { amount: fullAmount, description: definition.service_name || "Salon service" };
};

const normalizeServicePayload = ({ payload, actor, salonId }) => {
  if (!payload || typeof payload !== "object") throw paymentError("Service details are required.");
  if (!payload.service_definition_id) throw paymentError("Select a service.");
  if (!Array.isArray(payload.performers) || payload.performers.length === 0) {
    throw paymentError("Select the employees who performed this service.");
  }
  if (String(payload.entry_type || "current").toLowerCase() !== "current") {
    throw paymentError("External payments are available for current service entries only.");
  }

  const now = DateTime.now().setZone(KAMPALA_ZONE);
  return {
    ...payload,
    salon_id: salonId,
    created_by: Number(actor.id),
    customer_id: payload.customer_id ? Number(payload.customer_id) : null,
    entry_type: "current",
    service_source: payload.service_source || "walk_in",
    status: "completed",
    service_date: now.toISODate(),
    service_time: now.toFormat("HH:mm:ss"),
    collection_reference: null,
  };
};

const normalizeAppointmentCompletionPayload = async ({ payload, actor, salonId }) => {
  const appointmentId = Number(payload?.appointment_id);
  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    throw paymentError("A valid appointment is required.");
  }
  const appointment = await fetchServiceTransactionById(appointmentId, salonId);
  if (!appointment) throw paymentError("Appointment not found.", 404);
  if (String(appointment.status || "").toLowerCase() !== "confirmed") {
    throw paymentError("Only confirmed appointments can be completed.", 409);
  }
  if (!Array.isArray(payload?.performers) || payload.performers.length === 0) {
    throw paymentError("Select the employees who performed this service.");
  }
  await validateAppointmentRequestModel({
    salon_id: salonId,
    service_definition_id: Number(appointment.service_definition_id),
    appointment_date: appointment.appointment_date,
    appointment_time: appointment.appointment_time,
    performers: payload.performers,
    exclude_transaction_id: appointmentId,
    require_actual_employees: true,
    check_appointment_conflicts: false,
  });
  return {
    appointment,
    operationPayload: {
      appointment_id: appointmentId,
      performers: payload.performers,
      collection_method: payload.collection_method,
      initiated_by: Number(actor.id),
    },
  };
};

const validateCounterparty = ({ provider, payload }) => {
  if (provider === "BANK_TRANSFER") return null;
  const identifier = String(payload?.payer_phone || payload?.bank_account || "").trim();
  if (!identifier) {
    throw paymentError("A mobile-money number is required.");
  }
  if (identifier.length > 160) throw paymentError("Payment account details are too long.");
  return identifier;
};

const insertAudit = async (client, intentId, actorId, action, details = {}, actorRole = null) => {
  await client.query(
    `INSERT INTO payment_audit_logs (payment_intent_id, actor_user_id, action, details)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [intentId, actorId || null, action, JSON.stringify(details)],
  );
  const { rows } = await client.query(
    "SELECT salon_id, intent_reference FROM payment_intents WHERE id = $1",
    [intentId],
  );
  if (rows[0]) {
    await appendAuditEvent({
      client,
      salonId: rows[0].salon_id,
      actorUserId: actorId,
      actorRole,
      action: `PAYMENT_${action}`,
      module: "PAYMENTS",
      recordType: "PAYMENT_INTENT",
      recordId: intentId,
      newValues: { intent_reference: rows[0].intent_reference, ...details },
    });
  }
};

const serializeIntent = (row) => ({
  ...row,
  amount: Number(row.amount || 0),
  operation_payload: undefined,
});

const emitPaymentChange = (app, intent, transaction = null) => {
  const io = app?.get?.("io") || global.io;
  if (!io) return;
  const payload = {
    reference: intent.intent_reference,
    status: intent.payment_status,
    postingStatus: intent.posting_status,
    originType: intent.origin_type,
    transactionId: transaction?.id || null,
  };
  io.to(`salon:${intent.salon_id}`).emit("payment:changed", payload);
  io.to(`user:${intent.initiated_by}`).emit("payment:changed", payload);
  if (transaction?.id) {
    io.to(`salon:${intent.salon_id}`).emit("appointment:changed", {
      id: transaction.id,
      status: transaction.status,
      action: "payment-confirmed",
      updatedAt: new Date().toISOString(),
    });
  }
};

export const createServiceCollectionIntent = async ({ actor, salonId, payload, app }) => {
  if (!["owner", "manager", "cashier"].includes(String(actor?.role || "").toLowerCase())) {
    throw paymentError("You do not have permission to collect a service payment.", 403);
  }

  const provider = normalizeProvider(payload?.collection_method);
  const operation = String(payload?.payment_operation || "CREATE_SERVICE").toUpperCase();
  let originAction;
  let normalizedPayload;
  let definitionId;
  let serviceSource;

  if (operation === "APPOINTMENT_COMPLETE") {
    const completion = await normalizeAppointmentCompletionPayload({ payload, actor, salonId });
    originAction = "COMPLETE_APPOINTMENT";
    normalizedPayload = completion.operationPayload;
    definitionId = completion.appointment.service_definition_id;
    serviceSource = completion.appointment.service_source;
  } else if (operation === "CREATE_SERVICE") {
    originAction = "CREATE_COMPLETED_SERVICE";
    normalizedPayload = normalizeServicePayload({ payload, actor, salonId });
    definitionId = normalizedPayload.service_definition_id;
    serviceSource = normalizedPayload.service_source;
    await validateAppointmentRequestModel({
      salon_id: salonId,
      service_definition_id: Number(definitionId),
      appointment_date: null,
      appointment_time: null,
      performers: normalizedPayload.performers,
      require_actual_employees: true,
      check_appointment_conflicts: false,
    });
  } else {
    throw paymentError("Unsupported service payment operation.");
  }

  const servicePricing = await serviceAmount({
    salonId,
    serviceDefinitionId: definitionId,
    serviceSource,
  });
  const amount = servicePricing.amount;
  const counterpartyIdentifier = validateCounterparty({ provider, payload });
  const idempotencyKey = String(payload?.payment_idempotency_key || crypto.randomUUID()).slice(0, 120);

  const existing = await db.query(
    `SELECT * FROM payment_intents WHERE salon_id = $1 AND idempotency_key = $2`,
    [salonId, idempotencyKey],
  );
  if (existing.rows[0]) return serializeIntent(existing.rows[0]);

  const adapter = getProviderAdapter(provider);
  const intentReference = makeIntentReference();
  const bankAccount = provider === "BANK_TRANSFER" ? await activeBankAccount(salonId) : null;
  const bankPaymentReference = provider === "BANK_TRANSFER" ? makeBankPaymentReference() : null;
  const adapterResult =
    provider === "BANK_TRANSFER"
      ? adapter.initiateIncomingCollection({ intentReference, bankPaymentReference, amount, bankAccount })
      : adapter.initiate({ intentReference, amount, direction: "COLLECTION" });

  const intent = await db.transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO payment_intents (
        salon_id, intent_reference, idempotency_key, origin_type, origin_action,
        direction, provider, amount, counterparty_identifier, counterparty_name,
        operation_payload, operation_description, provider_reference, payment_status, posting_status,
        initiated_by, expires_at, bank_account_id, bank_payment_reference, reconciliation_status
      ) VALUES ($1,$2,$3,'SERVICE_TRANSACTION',$4,
        'COLLECTION',$5,$6,$7,$8,$9::jsonb,$10,$11,'PENDING','PENDING',$12,NOW() + INTERVAL '15 minutes',$13,$14,$15)
      ON CONFLICT (salon_id, idempotency_key) DO NOTHING RETURNING *`,
      [
        salonId,
        intentReference,
        idempotencyKey,
        originAction,
        provider,
        amount,
        counterpartyIdentifier,
        String(payload?.payer_name || "").trim() || null,
        JSON.stringify({ ...normalizedPayload, collection_method: provider }),
        operation === "APPOINTMENT_COMPLETE"
          ? `Appointment completion · ${servicePricing.description}`
          : `Service · ${servicePricing.description}`,
        adapterResult.providerReference,
        actor.id,
        bankAccount?.id || null,
        bankPaymentReference,
        bankAccount ? "PENDING" : "NOT_REQUIRED",
      ],
    );
    if (!rows[0]) {
      return (await client.query(
        `SELECT * FROM payment_intents WHERE salon_id = $1 AND idempotency_key = $2`,
        [salonId, idempotencyKey],
      )).rows[0];
    }
    const created = rows[0];
    await client.query(
      `INSERT INTO payment_attempts (
        payment_intent_id, attempt_number, provider, provider_reference, attempt_status, request_metadata, response_metadata
      ) VALUES ($1,1,$2,$3,'PENDING',$4::jsonb,$5::jsonb)`,
      [
        created.id,
        provider,
        adapterResult.providerReference,
        JSON.stringify({ direction: "COLLECTION", amount, currency: "UGX" }),
        JSON.stringify({ mode: adapter.mode, status: adapterResult.status }),
      ],
    );
    await insertAudit(client, created.id, actor.id, "PAYMENT_INITIATED", { provider, amount }, actor.role);
    return created;
  });

  emitPaymentChange(app, intent);
  if (provider !== "BANK_TRANSFER") {
    scheduleMockConfirmation({ app, intentId: intent.id, delayMs: adapter.delayMs });
  }
  return {
    ...serializeIntent(intent),
    customer_message: adapterResult.customerMessage,
    bank_account: bankAccount,
  };
};

export const createAdvanceRepaymentIntent = async ({ actor, salonId, payload, app }) => {
  if (!["owner", "manager"].includes(String(actor?.role || "").toLowerCase())) {
    throw paymentError("Only an owner or manager may record an advance repayment.", 403);
  }
  const provider = normalizeProvider(payload?.collection_method);
  const requestId = Number(payload?.origin_id);
  const requestedAmount = numericAmount(payload?.amount, "Repayment amount");
  const { rows } = await db.query(
    `SELECT ar.id, ar.employee_id, ar.requested_amount, ar.workflow_status,
            TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS employee_name,
            COALESCE((SELECT SUM(s.amount) FROM employee_advance_settlements s
                      WHERE s.advance_request_id = ar.id AND s.salon_id = ar.salon_id
                        AND s.workflow_status = 'EFFECTIVE'), 0)::numeric AS settled_amount
       FROM employee_advance_requests ar
       JOIN users u ON u.id = ar.employee_id AND u.salon_id = ar.salon_id
      WHERE ar.id = $1 AND ar.salon_id = $2`,
    [requestId, salonId],
  );
  const advance = rows[0];
  if (!advance || !["DISBURSED", "ACKNOWLEDGED"].includes(advance.workflow_status)) {
    throw paymentError("Only a disbursed advance can receive a repayment.", 409);
  }
  const outstanding = Math.max(Number(advance.requested_amount) - Number(advance.settled_amount), 0);
  if (requestedAmount > outstanding) {
    throw paymentError(`Repayment exceeds the outstanding advance of ${outstanding.toLocaleString("en-UG")} UGX.`);
  }
  if (!String(payload?.settlement_signature_data_url || "").startsWith("data:image/")) {
    throw paymentError("Management signature is required before initiating this repayment.");
  }

  const counterpartyIdentifier = validateCounterparty({ provider, payload });
  const idempotencyKey = String(payload?.payment_idempotency_key || crypto.randomUUID()).slice(0, 120);
  const existing = await db.query(
    `SELECT * FROM payment_intents WHERE salon_id = $1 AND idempotency_key = $2`,
    [salonId, idempotencyKey],
  );
  if (existing.rows[0]) return serializeIntent(existing.rows[0]);

  const adapter = getProviderAdapter(provider);
  const intentReference = makeIntentReference();
  const bankAccount = provider === "BANK_TRANSFER" ? await activeBankAccount(salonId) : null;
  const bankPaymentReference = provider === "BANK_TRANSFER" ? makeBankPaymentReference() : null;
  const adapterResult = provider === "BANK_TRANSFER"
    ? adapter.initiateIncomingCollection({ intentReference, bankPaymentReference, amount: requestedAmount, bankAccount })
    : adapter.initiate({ intentReference, amount: requestedAmount, direction: "COLLECTION" });
  const intent = await db.transaction(async (client) => {
    const { rows: createdRows } = await client.query(
      `INSERT INTO payment_intents (
         salon_id, intent_reference, idempotency_key, origin_type, origin_action, direction,
         provider, amount, counterparty_identifier, counterparty_name, operation_payload,
         operation_description, provider_reference, payment_status, posting_status, initiated_by,
         expires_at, bank_account_id, bank_payment_reference, reconciliation_status
       ) VALUES ($1,$2,$3,'ADVANCE_REPAYMENT','SETTLE_ADVANCE','COLLECTION',$4,$5,$6,$7,$8::jsonb,$9,$10,
         'PENDING','PENDING',$11,NOW() + INTERVAL '30 minutes',$12,$13,$14)
       ON CONFLICT (salon_id, idempotency_key) DO NOTHING RETURNING *`,
      [salonId, intentReference, idempotencyKey, provider, requestedAmount, counterpartyIdentifier,
        advance.employee_name, JSON.stringify({
          request_id: requestId,
          amount: requestedAmount,
          settlement_method: provider,
          notes: String(payload?.notes || "").trim() || null,
          settlement_signature_data_url: payload.settlement_signature_data_url,
          actor_role: actor.role,
        }), `Advance repayment · ${advance.employee_name}`, adapterResult.providerReference,
        actor.id, bankAccount?.id || null, bankPaymentReference, bankAccount ? "PENDING" : "NOT_REQUIRED"],
    );
    if (!createdRows[0]) {
      return (await client.query(
        `SELECT * FROM payment_intents WHERE salon_id = $1 AND idempotency_key = $2`,
        [salonId, idempotencyKey],
      )).rows[0];
    }
    const created = createdRows[0];
    await client.query(
      `INSERT INTO payment_attempts (payment_intent_id, attempt_number, provider, provider_reference,
         attempt_status, request_metadata, response_metadata)
       VALUES ($1,1,$2,$3,'PENDING',$4::jsonb,$5::jsonb)`,
      [created.id, provider, adapterResult.providerReference,
        JSON.stringify({ direction: "COLLECTION", amount: requestedAmount, currency: "UGX" }),
        JSON.stringify({ mode: adapter.mode, status: adapterResult.status })],
    );
    await insertAudit(client, created.id, actor.id, "ADVANCE_REPAYMENT_INITIATED", { provider, amount: requestedAmount, requestId }, actor.role);
    return created;
  });
  emitPaymentChange(app, intent);
  if (provider !== "BANK_TRANSFER") scheduleMockConfirmation({ app, intentId: intent.id, delayMs: adapter.delayMs });
  return { ...serializeIntent(intent), customer_message: adapterResult.customerMessage, bank_account: bankAccount };
};

export const createExternalDisbursementIntent = async ({ actor, salonId, payload, app }) => {
  if (!["owner", "manager", "cashier"].includes(String(actor?.role || "").toLowerCase())) {
    throw paymentError("You do not have permission to initiate this payment.", 403);
  }
  const provider = normalizeProvider(payload?.payment_method);
  const originType = String(payload?.origin_type || "").toUpperCase();
  const idempotencyKey = String(payload?.payment_idempotency_key || crypto.randomUUID()).slice(0, 120);
  const existing = await db.query(
    `SELECT * FROM payment_intents WHERE salon_id = $1 AND idempotency_key = $2`,
    [salonId, idempotencyKey],
  );
  if (existing.rows[0]) return serializeIntent(existing.rows[0]);

  const recipientIdentifier = String(payload?.recipient_phone || payload?.recipient_account || "").trim();
  if (!recipientIdentifier) {
    throw paymentError(provider === "BANK_TRANSFER" ? "A recipient bank account is required." : "A recipient mobile-money number is required.");
  }
  let amount;
  let originAction;
  let operationPayload;
  let recipientName = String(payload?.recipient_name || "").trim() || null;
  if (originType === "EXPENSE") {
    amount = numericAmount(payload?.expense?.amount, "Expense amount");
    if (!String(payload?.expense?.name || "").trim()) throw paymentError("Expense name is required.");
    originAction = "CREATE_EXPENSE";
    operationPayload = { expense: { ...payload.expense, entry_type: "current" }, actor_role: actor.role };
  } else if (originType === "EMPLOYEE_ADVANCE") {
    const requestId = Number(payload?.origin_id);
    const { rows } = await db.query(
      `SELECT ar.id, ar.requested_amount, ar.workflow_status,
        TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS employee_name
       FROM employee_advance_requests ar JOIN users u ON u.id = ar.employee_id AND u.salon_id = ar.salon_id
       WHERE ar.id = $1 AND ar.salon_id = $2`, [requestId, salonId],
    );
    if (!rows[0] || rows[0].workflow_status !== "APPROVED") throw paymentError("Only an approved advance may be disbursed externally.", 409);
    amount = numericAmount(rows[0].requested_amount);
    recipientName ||= rows[0].employee_name;
    originAction = "DISBURSE_ADVANCE";
    operationPayload = { request_id: requestId, actor_role: actor.role };
  } else if (originType === "EMPLOYEE_PAYMENT") {
    const paymentId = Number(payload?.origin_id);
    const { rows } = await db.query(
      `SELECT ep.id, ep.requested_amount, ep.workflow_status,
        TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS employee_name
       FROM employee_payments ep JOIN users u ON u.id = ep.employee_id AND u.salon_id = ep.salon_id
       WHERE ep.id = $1 AND ep.salon_id = $2`, [paymentId, salonId],
    );
    if (!rows[0] || rows[0].workflow_status !== "APPROVED") throw paymentError("Only an approved employee payment may be disbursed externally.", 409);
    amount = numericAmount(rows[0].requested_amount);
    recipientName ||= rows[0].employee_name;
    originAction = "DISBURSE_EMPLOYEE_PAYMENT";
    operationPayload = { payment_id: paymentId, actor_role: actor.role };
  } else {
    throw paymentError("Unsupported external disbursement.");
  }

  const adapter = getProviderAdapter(provider);
  const operationDescription = originType === "EXPENSE"
    ? `Expense · ${String(payload?.expense?.name || "Expense").trim()}`
    : `${originType === "EMPLOYEE_ADVANCE" ? "Employee advance" : "Employee payment"} · ${recipientName || "Recipient"}`;
  const intentReference = makeIntentReference();
  const adapterResult = provider === "BANK_TRANSFER"
    ? adapter.initiatePayout({ intentReference, amount })
    : adapter.initiate({ intentReference, amount, direction: "DISBURSEMENT" });
  const intent = await db.transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO payment_intents (
        salon_id, intent_reference, idempotency_key, origin_type, origin_action, direction,
        provider, amount, counterparty_identifier, counterparty_name, operation_payload,
        operation_description, provider_reference, payment_status, posting_status, initiated_by, expires_at,
        manual_execution_status
      ) VALUES ($1,$2,$3,$4,$5,'DISBURSEMENT',$6,$7,$8,$9,$10::jsonb,$11,$12,'PENDING','PENDING',$13,NOW() + INTERVAL '15 minutes',$14)
      ON CONFLICT (salon_id, idempotency_key) DO NOTHING RETURNING *`,
      [salonId, intentReference, idempotencyKey, originType, originAction, provider, amount, recipientIdentifier, recipientName, JSON.stringify(operationPayload), operationDescription, adapterResult.providerReference, actor.id, adapter.mode === "manual" ? "AWAITING_EXECUTION" : "NOT_REQUIRED"],
    );
    if (!rows[0]) {
      return (await client.query(
        `SELECT * FROM payment_intents WHERE salon_id = $1 AND idempotency_key = $2`,
        [salonId, idempotencyKey],
      )).rows[0];
    }
    const created = rows[0];
    await client.query(`INSERT INTO payment_attempts (payment_intent_id, attempt_number, provider, provider_reference, attempt_status, request_metadata, response_metadata) VALUES ($1,1,$2,$3,'PENDING',$4::jsonb,$5::jsonb)`, [created.id, provider, adapterResult.providerReference, JSON.stringify({ direction: "DISBURSEMENT", amount, currency: "UGX" }), JSON.stringify({ mode: adapter.mode, status: adapterResult.status })]);
    await insertAudit(client, created.id, actor.id, "PAYOUT_INITIATED", { provider, amount, originType }, actor.role);
    return created;
  });
  emitPaymentChange(app, intent);
  if (adapter.mode === "mock") scheduleMockConfirmation({ app, intentId: intent.id, delayMs: adapter.delayMs });
  return { ...serializeIntent(intent), customer_message: adapterResult.customerMessage };
};

export const verifyManualBankDisbursement = async ({ app, salonId, actor, reference, bankTransactionId, verificationNote }) => {
  if (!['owner', 'manager'].includes(String(actor?.role || '').toLowerCase())) {
    throw paymentError('Only an owner or manager may verify a manual bank payout.', 403);
  }
  const safeTransactionId = String(bankTransactionId || '').trim();
  if (!safeTransactionId) throw paymentError('Enter the bank transaction ID from the verified payout evidence.');
  const verified = await db.transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE payment_intents
       SET payment_status = 'CONFIRMED', confirmed_at = NOW(), verification_status = 'VERIFIED',
           provider_transaction_id = $1, manual_execution_status = 'VERIFIED',
           manual_execution_reference = $1, manual_execution_note = $2,
           manual_verified_by = $3, manual_verified_at = NOW(), updated_at = NOW()
       WHERE salon_id = $4 AND intent_reference = $5 AND provider = 'BANK_TRANSFER'
         AND direction = 'DISBURSEMENT' AND payment_status = 'PENDING'
         AND manual_execution_status IN ('AWAITING_EXECUTION', 'SUBMITTED')
       RETURNING *`,
      [safeTransactionId, String(verificationNote || '').trim() || null, actor.id, salonId, reference],
    );
    if (!rows[0]) throw paymentError('This bank payout is unavailable for manual verification.', 409);
    await insertAudit(client, rows[0].id, actor.id, 'MANUAL_BANK_PAYOUT_VERIFIED', { bankTransactionId: safeTransactionId }, actor.role);
    return rows[0];
  });
  return finalizeConfirmedPayment({ app, intentId: verified.id });
};

const scheduleMockConfirmation = ({ app, intentId, delayMs }) => {
  if (scheduledMockPayments.has(intentId)) return;
  const authorizationDelay = Math.max(250, Math.floor(Math.max(500, delayMs) / 2));
  const callbackDelay = Math.max(250, Math.max(500, delayMs) - authorizationDelay);
  const authorizationHandle = setTimeout(async () => {
    try {
      await recordMockCustomerAuthorization({ intentId });
      const callbackHandle = setTimeout(async () => {
        scheduledMockPayments.delete(intentId);
        try {
          await resolveMockPayment({ app, intentId, outcome: "CONFIRMED" });
        } catch (error) {
          console.error("Mock payment resolution failed", { intentId, message: error.message });
        }
      }, callbackDelay);
      scheduledMockPayments.set(intentId, callbackHandle);
    } catch (error) {
      scheduledMockPayments.delete(intentId);
      console.error("Mock payment authorization failed", { intentId, message: error.message });
    }
  }, authorizationDelay);
  scheduledMockPayments.set(intentId, authorizationHandle);
};

const recordMockCustomerAuthorization = async ({ intentId }) => db.transaction(async (client) => {
  const { rows } = await client.query(
    `SELECT id, provider, direction, payment_status FROM payment_intents WHERE id = $1 FOR UPDATE`,
    [intentId],
  );
  const intent = rows[0];
  if (!intent || intent.payment_status !== "PENDING") return false;
  const eventId = `mock-${intent.id}-customer-authorized`;
  await client.query(
    `INSERT INTO payment_provider_events (
       payment_intent_id, provider, provider_event_id, event_type, event_payload, processed_at, processing_result
     ) VALUES ($1,$2,$3,'CUSTOMER_AUTHORIZED',$4::jsonb,NOW(),'ACCEPTED')
     ON CONFLICT (provider, provider_event_id) DO NOTHING`,
    [intent.id, intent.provider, eventId, JSON.stringify({ mode: "mock", direction: intent.direction })],
  );
  await insertAudit(client, intent.id, null, "MOCK_CUSTOMER_AUTHORIZED", { provider: intent.provider, direction: intent.direction });
  return true;
});

export const resumePendingMockPayments = async ({ app }) => {
  if (isProduction() || String(process.env.PAYMENTS_MODE || "mock").trim().toLowerCase() !== "mock") return;
  const { rows } = await db.query(
    `SELECT id
     FROM payment_intents
     WHERE payment_status = 'PENDING'
       AND (
         provider IN ('MTN_MOMO', 'AIRTEL_MONEY')
         OR (provider = 'BANK_TRANSFER' AND direction = 'DISBURSEMENT')
       )
     ORDER BY created_at ASC
     LIMIT 100`,
  );
  for (const row of rows) {
    scheduleMockConfirmation({ app, intentId: row.id, delayMs: 1200 });
  }
};

export const resolveMockPayment = async ({ app, intentId, outcome = "CONFIRMED" }) => {
  if (isProduction()) throw paymentError("Development payment simulation is unavailable in production.", 404);
  let result = await db.transaction(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM payment_intents WHERE id = $1 FOR UPDATE`,
      [intentId],
    );
    const intent = rows[0];
    if (!intent) throw paymentError("Payment intent not found.", 404);
    if (intent.payment_status !== "PENDING") return intent;

    const eventId = `mock-${intent.id}-${outcome.toLowerCase()}`;
    await client.query(
      `INSERT INTO payment_provider_events (
        payment_intent_id, provider, provider_event_id, event_type, event_payload, processed_at, processing_result
      ) VALUES ($1,$2,$3,$4,$5::jsonb,NOW(),'ACCEPTED')
      ON CONFLICT (provider, provider_event_id) DO NOTHING`,
      [intent.id, intent.provider, eventId, `PROVIDER_CALLBACK_${outcome}`, JSON.stringify({ mode: "mock", outcome })],
    );

    const isConfirmed = outcome === "CONFIRMED";
    const normalizedOutcome = ["CONFIRMED", "FAILED", "REJECTED", "TIMED_OUT"].includes(outcome)
      ? outcome
      : "FAILED";
    const { rows: updatedRows } = await client.query(
      `UPDATE payment_intents
       SET payment_status = $1::varchar,
           confirmed_at = CASE WHEN $1::varchar = 'CONFIRMED' THEN NOW() ELSE NULL END,
           verification_status = CASE WHEN $1::varchar = 'CONFIRMED' THEN 'VERIFIED' ELSE 'FAILED' END,
           provider_transaction_id = CASE WHEN $1::varchar = 'CONFIRMED' THEN COALESCE(provider_transaction_id, provider_reference) ELSE provider_transaction_id END,
           failure_code = CASE WHEN $1::varchar = 'FAILED' THEN 'MOCK_DECLINED' ELSE NULL END,
           failure_message = CASE WHEN $1::varchar = 'FAILED' THEN 'The development payment was declined.' ELSE NULL END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [isConfirmed ? "CONFIRMED" : "FAILED", intent.id],
    );
    await client.query(
      `UPDATE payment_attempts
       SET attempt_status = $1, completed_at = NOW(), response_metadata = COALESCE(response_metadata, '{}'::jsonb) || $2::jsonb
       WHERE payment_intent_id = $3 AND attempt_number = 1`,
      [isConfirmed ? "CONFIRMED" : "FAILED", JSON.stringify({ outcome: normalizedOutcome }), intent.id],
    );
    await insertAudit(client, intent.id, null, `MOCK_${normalizedOutcome}`, { provider: intent.provider });
    return updatedRows[0];
  });

  if (result.payment_status === "CONFIRMED") {
    await finalizeConfirmedPayment({ app, intentId: result.id });
  } else {
    emitPaymentChange(app, result);
  }
  return result;
};

export const receiveBankCredit = async ({
  app,
  salonId,
  bankAccountId,
  amount,
  currency = "UGX",
  transferReference,
  bankTransactionId,
  source = "bank-notification",
  notificationDelivered = true,
  providerFee = null,
}) => {
  let result = await db.transaction(async (client) => {
    const { rows: accountRows } = await client.query(
      `SELECT id, salon_id, currency FROM salon_bank_accounts
       WHERE id = $1 AND salon_id = $2 AND is_active = TRUE FOR KEY SHARE`,
      [bankAccountId, salonId],
    );
    const account = accountRows[0];
    if (!account) throw paymentError("The selected official bank account is unavailable.", 404);

    const safeAmount = numericAmount(amount, "Incoming credit amount");
    const safeCurrency = String(currency || "UGX").trim().toUpperCase();
    const safeReference = String(transferReference || "").trim() || null;
    const safeBankTransactionId = String(bankTransactionId || "").trim();
    if (!safeBankTransactionId) throw paymentError("A bank transaction ID is required.");

    const existingCredit = await client.query(
      `SELECT * FROM bank_incoming_credits WHERE provider = 'BANK_TRANSFER' AND bank_transaction_id = $1`,
      [safeBankTransactionId],
    );
    if (existingCredit.rows[0]) {
      const existingIntent = existingCredit.rows[0].matched_payment_intent_id
        ? (await client.query(`SELECT * FROM payment_intents WHERE id = $1`, [existingCredit.rows[0].matched_payment_intent_id])).rows[0]
        : null;
      return { credit: existingCredit.rows[0], intent: existingIntent, duplicate: true };
    }

    const match = notificationDelivered && safeReference
      ? await client.query(
          `SELECT * FROM payment_intents
           WHERE salon_id = $1 AND provider = 'BANK_TRANSFER' AND direction = 'COLLECTION'
             AND payment_status = 'PENDING' AND bank_account_id = $2
             AND bank_payment_reference = $3 AND amount = $4 AND currency = $5
           FOR UPDATE`,
          [salonId, bankAccountId, safeReference, safeAmount, safeCurrency],
        )
      : { rows: [] };
    const intent = match.rows[0] || null;
    const { rows: creditRows } = await client.query(
      `INSERT INTO bank_incoming_credits (
         salon_id, bank_account_id, bank_transaction_id, transfer_reference, amount, currency,
         credit_status, credited_at, notification_payload, matched_payment_intent_id, match_status,
         notification_status, notification_attempts, last_notification_attempt_at, provider_fee
       ) VALUES ($1,$2,$3,$4,$5,$6,'CONFIRMED',NOW(),$7::jsonb,$8,$9,$10,1,NOW(),$11)
       RETURNING *`,
      [
        salonId,
        bankAccountId,
        safeBankTransactionId,
        safeReference,
        safeAmount,
        safeCurrency,
        JSON.stringify({ source, notification: "incoming-credit" }),
        intent?.id || null,
        intent ? "MATCHED" : "UNMATCHED",
        notificationDelivered ? "DELIVERED" : "FAILED",
        providerFee === null || providerFee === undefined ? null : Number(providerFee),
      ],
    );
    const credit = creditRows[0];
    if (!intent) return { credit, intent: null, duplicate: false };

    const { rows: updatedRows } = await client.query(
      `UPDATE payment_intents
       SET payment_status = 'CONFIRMED', confirmed_at = NOW(), provider_transaction_id = $1,
           reconciliation_status = 'MATCHED', verification_status = 'VERIFIED',
           provider_fee = $3, reconciled_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [safeBankTransactionId, intent.id, providerFee === null || providerFee === undefined ? null : Number(providerFee)],
    );
    await client.query(
      `UPDATE payment_attempts SET attempt_status = 'CONFIRMED', completed_at = NOW(),
       response_metadata = COALESCE(response_metadata, '{}'::jsonb) || $1::jsonb
       WHERE payment_intent_id = $2 AND attempt_number = 1`,
      [JSON.stringify({ bankTransactionId: safeBankTransactionId, transferReference: safeReference }), intent.id],
    );
    await client.query(
      `INSERT INTO payment_provider_events (payment_intent_id, provider, provider_event_id, event_type, event_payload, processed_at, processing_result)
       VALUES ($1,'BANK_TRANSFER',$2,'INCOMING_CREDIT',$3::jsonb,NOW(),'ACCEPTED')
       ON CONFLICT (provider, provider_event_id) DO NOTHING`,
      [intent.id, safeBankTransactionId, JSON.stringify({ amount: safeAmount, currency: safeCurrency, transferReference: safeReference })],
    );
    await insertAudit(client, intent.id, null, "BANK_CREDIT_MATCHED", { bankTransactionId: safeBankTransactionId });
    return { credit, intent: updatedRows[0], duplicate: false };
  });

  if (!result.intent && result.duplicate && notificationDelivered && result.credit?.transfer_reference) {
    const candidates = await db.query(
      `SELECT * FROM payment_intents
        WHERE salon_id = $1 AND provider = 'BANK_TRANSFER' AND direction = 'COLLECTION'
          AND payment_status = 'PENDING' AND bank_account_id = $2
          AND bank_payment_reference = $3 AND amount = $4 AND currency = $5`,
      [salonId, bankAccountId, result.credit.transfer_reference, result.credit.amount, result.credit.currency],
    );
    if (candidates.rows.length === 1) {
      const recovered = await recoverUnmatchedBankCredit({ app, intent: candidates.rows[0] });
      result = { ...result, intent: recovered };
    }
  }
  if (result.intent) await finalizeConfirmedPayment({ app, intentId: result.intent.id });
  return result;
};

export const receiveMockBankCredit = async (input) => receiveBankCredit({
  ...input,
  bankTransactionId: String(input.bankTransactionId || "").trim()
    || `MOCK-BANK-${crypto.randomBytes(7).toString("hex").toUpperCase()}`,
  source: "mock-bank",
});

const recoverUnmatchedBankCredit = async ({ app, intent }) => {
  const recovered = await db.transaction(async (client) => {
    const { rows: lockedIntents } = await client.query(
      `SELECT * FROM payment_intents WHERE id = $1 AND payment_status = 'PENDING' FOR UPDATE`,
      [intent.id],
    );
    const lockedIntent = lockedIntents[0];
    if (!lockedIntent) return null;
    const { rows: credits } = await client.query(
      `SELECT * FROM bank_incoming_credits
        WHERE salon_id = $1 AND bank_account_id = $2 AND matched_payment_intent_id IS NULL
          AND credit_status = 'CONFIRMED' AND transfer_reference = $3
          AND amount = $4 AND currency = $5
        ORDER BY credited_at ASC FOR UPDATE`,
      [lockedIntent.salon_id, lockedIntent.bank_account_id, lockedIntent.bank_payment_reference,
        lockedIntent.amount, lockedIntent.currency],
    );
    if (credits.length !== 1) {
      if (credits.length > 1) {
        await client.query(
          `UPDATE payment_intents SET verification_status = 'INVESTIGATION',
             reconciliation_status = 'INVESTIGATING', updated_at = NOW() WHERE id = $1`,
          [lockedIntent.id],
        );
      }
      return null;
    }
    const credit = credits[0];
    const claimed = await client.query(
      `UPDATE bank_incoming_credits SET matched_payment_intent_id = $1, match_status = 'MATCHED',
         notification_status = CASE WHEN notification_status = 'FAILED' THEN 'RECOVERED' ELSE notification_status END
       WHERE id = $2 AND matched_payment_intent_id IS NULL RETURNING *`,
      [lockedIntent.id, credit.id],
    );
    if (!claimed.rows[0]) return null;
    const { rows: updated } = await client.query(
      `UPDATE payment_intents SET payment_status = 'CONFIRMED', confirmed_at = NOW(),
         provider_transaction_id = $1, provider_fee = $2, verification_status = 'VERIFIED',
         reconciliation_status = 'MATCHED', reconciled_at = NOW(), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [credit.bank_transaction_id, credit.provider_fee, lockedIntent.id],
    );
    await client.query(
      `UPDATE payment_attempts SET attempt_status = 'CONFIRMED', completed_at = NOW(),
         response_metadata = COALESCE(response_metadata, '{}'::jsonb) || $1::jsonb
       WHERE payment_intent_id = $2 AND attempt_number = 1`,
      [JSON.stringify({ recoveredByInquiry: true, bankTransactionId: credit.bank_transaction_id }), lockedIntent.id],
    );
    await insertAudit(client, lockedIntent.id, null, "BANK_CREDIT_RECOVERED_BY_INQUIRY", { bankTransactionId: credit.bank_transaction_id });
    return updated[0];
  });
  if (recovered) await finalizeConfirmedPayment({ app, intentId: recovered.id });
  return recovered;
};

export const reconcileUnmatchedBankCredits = async ({ app, limit = 100 } = {}) => {
  const { rows } = await db.query(
    `SELECT DISTINCT pi.*
       FROM payment_intents pi
       JOIN bank_incoming_credits bic
         ON bic.salon_id = pi.salon_id
        AND bic.bank_account_id = pi.bank_account_id
        AND bic.transfer_reference = pi.bank_payment_reference
        AND bic.amount = pi.amount
        AND bic.currency = pi.currency
        AND bic.matched_payment_intent_id IS NULL
        AND bic.credit_status = 'CONFIRMED'
      WHERE pi.provider = 'BANK_TRANSFER' AND pi.direction = 'COLLECTION'
        AND pi.payment_status = 'PENDING'
      ORDER BY pi.created_at ASC LIMIT $1`,
    [Math.max(1, Math.min(Number(limit) || 100, 500))],
  );
  const recovered = [];
  for (const intent of rows) {
    const matched = await recoverUnmatchedBankCredit({ app, intent });
    if (matched) recovered.push(matched);
  }
  return recovered;
};

export const recordBankTransferInquiry = async ({ app, salonId, actorId, actorRole, reference }) => {
  const { rows } = await db.query(
    `SELECT * FROM payment_intents
     WHERE salon_id = $1 AND intent_reference = $2 AND provider = 'BANK_TRANSFER'
       AND ($4::boolean OR initiated_by = $3)`,
    [salonId, reference, actorId, ["owner", "manager"].includes(String(actorRole || "").toLowerCase())],
  );
  if (!rows[0]) throw paymentError("Bank transfer request not found.", 404);
  await db.transaction((client) => insertAudit(client, rows[0].id, actorId, "BANK_TRANSFER_INQUIRY", { mode: "mock" }, actorRole));
  let resolved = await recoverUnmatchedBankCredit({ app, intent: rows[0] });

  // Development convenience only: the cashier's declaration is translated into
  // an external mock-bank credit. It still travels through receiveBankCredit,
  // exact matching, duplicate protection, and normal business finalization.
  // Production inquiries never fabricate a credit.
  if (!resolved
    && !isProduction()
    && String(process.env.PAYMENTS_MODE || "mock").trim().toLowerCase() === "mock"
    && rows[0].payment_status === "PENDING") {
    const simulated = await receiveMockBankCredit({
      app,
      salonId,
      bankAccountId: rows[0].bank_account_id,
      amount: rows[0].amount,
      currency: rows[0].currency,
      transferReference: rows[0].bank_payment_reference,
      notificationDelivered: true,
      source: "cashier-development-bank-transfer",
    });
    resolved = simulated.intent || null;
  }

  return getPaymentIntentForActor({ salonId, actorId, reference, allowFinanceRole: ["owner", "manager"].includes(String(actorRole || "").toLowerCase()), fallback: resolved || rows[0] });
};

export const finalizeConfirmedPayment = async ({ app, intentId }) => {
  const claimed = await db.transaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE payment_intents
       SET posting_status = 'FINALIZING', finalization_attempts = finalization_attempts + 1,
           last_finalization_attempt_at = NOW(), next_finalization_attempt_at = NULL, updated_at = NOW()
       WHERE id = $1 AND payment_status = 'CONFIRMED'
         AND (
           posting_status = 'PENDING'
           OR (posting_status = 'FAILED' AND (next_finalization_attempt_at IS NULL OR next_finalization_attempt_at <= NOW()))
           OR (posting_status = 'FINALIZING' AND updated_at < NOW() - INTERVAL '5 minutes')
         )
       RETURNING *`,
      [intentId],
    );
    if (rows[0]) await insertAudit(client, rows[0].id, null, "POSTING_STARTED");
    return rows[0] || null;
  });
  if (!claimed) return null;

  try {
    const payload = claimed.operation_payload;
    let transaction = null;
    if (claimed.origin_type === "SERVICE_TRANSACTION") {
      transaction = (await db.query(
        `SELECT * FROM service_transactions WHERE salon_id = $1 AND external_payment_intent_id = $2 LIMIT 1`,
        [claimed.salon_id, claimed.id],
      )).rows[0] || null;
    } else if (claimed.origin_type === "EXPENSE") {
      transaction = (await db.query(
        `SELECT * FROM expenses WHERE salon_id = $1 AND external_payment_intent_id = $2 LIMIT 1`,
        [claimed.salon_id, claimed.id],
      )).rows[0] || null;
    } else if (claimed.origin_type === "EMPLOYEE_ADVANCE") {
      transaction = (await db.query(
        `SELECT * FROM employee_advance_requests WHERE salon_id = $1 AND external_payment_intent_id = $2 LIMIT 1`,
        [claimed.salon_id, claimed.id],
      )).rows[0] || null;
    } else if (claimed.origin_type === "EMPLOYEE_PAYMENT") {
      transaction = (await db.query(
        `SELECT * FROM employee_payments WHERE salon_id = $1 AND external_payment_intent_id = $2 LIMIT 1`,
        [claimed.salon_id, claimed.id],
      )).rows[0] || null;
    } else if (claimed.origin_type === "ADVANCE_REPAYMENT") {
      transaction = (await db.query(
        `SELECT * FROM employee_advance_settlements WHERE salon_id = $1 AND external_payment_intent_id = $2 LIMIT 1`,
        [claimed.salon_id, claimed.id],
      )).rows[0] || null;
    }

    if (!transaction && claimed.origin_type === "SERVICE_TRANSACTION") {
      transaction = claimed.origin_action === "COMPLETE_APPOINTMENT"
        ? await updateServiceTransactionAppointmentModel(
            payload.appointment_id,
            {
              status: "completed",
              cancel_reason: null,
              performers: payload.performers,
              service_date: DateTime.now().setZone(KAMPALA_ZONE).toISODate(),
              service_time: DateTime.now().setZone(KAMPALA_ZONE).toFormat("HH:mm:ss"),
              collection_method: claimed.provider,
              collection_reference: claimed.provider_reference,
              external_payment_intent_id: claimed.id,
            },
            claimed.salon_id,
          )
        : await saveServiceTransaction({
            ...payload,
            collection_method: claimed.provider,
            collection_reference: claimed.provider_reference,
            external_payment_intent_id: claimed.id,
          });
    } else if (!transaction && claimed.origin_type === "EXPENSE") {
      transaction = await saveExpense({
        ...payload.expense,
        salon_id: claimed.salon_id,
        expense_date: DateTime.now().setZone(KAMPALA_ZONE).toISODate(),
        expense_time: DateTime.now().setZone(KAMPALA_ZONE).toFormat("HH:mm:ss"),
        entry_type: "current",
        backdate_reason: null,
        external_payment_intent_id: claimed.id,
      });
    } else if (!transaction && claimed.origin_type === "EMPLOYEE_ADVANCE") {
      transaction = await disburseAdvanceRequest({ salonId: claimed.salon_id, actorId: claimed.initiated_by, actorRole: payload.actor_role, requestId: payload.request_id, externalPaymentIntentId: claimed.id });
    } else if (!transaction && claimed.origin_type === "EMPLOYEE_PAYMENT") {
      transaction = await disburseEmployeePayment({ salonId: claimed.salon_id, actorId: claimed.initiated_by, actorRole: payload.actor_role, paymentId: payload.payment_id, externalPaymentIntentId: claimed.id });
    } else if (!transaction && claimed.origin_type === "ADVANCE_REPAYMENT") {
      transaction = await settleAdvanceRequest({
        salonId: claimed.salon_id,
        actorId: claimed.initiated_by,
        actorRole: payload.actor_role,
        requestId: payload.request_id,
        amount: payload.amount,
        settlementMethod: payload.settlement_method,
        notes: payload.notes,
        settlementSignatureDataUrl: payload.settlement_signature_data_url,
        externalPaymentIntentId: claimed.id,
      });
    } else if (!transaction) {
      throw new Error(`Unsupported payment origin: ${claimed.origin_type}`);
    }
    const refreshed = claimed.origin_type === "SERVICE_TRANSACTION" ? await fetchServiceTransactionById(transaction.id, claimed.salon_id) : transaction;
    const posted = await db.transaction(async (client) => {
      await client.query(
        `INSERT INTO payment_allocations (payment_intent_id, salon_id, source_type, source_id, amount)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (payment_intent_id) DO NOTHING`,
        [claimed.id, claimed.salon_id, claimed.origin_type, transaction.id, claimed.amount],
      );
      const { rows } = await client.query(
        `UPDATE payment_intents
         SET posting_status = 'POSTED', verification_status = 'VERIFIED', posted_at = NOW(),
             next_finalization_attempt_at = NULL, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [claimed.id],
      );
      await insertAudit(client, claimed.id, null, "BUSINESS_OPERATION_POSTED", {
        sourceType: claimed.origin_type,
        sourceId: transaction.id,
      });
      return rows[0];
    });
    emitPaymentChange(app, posted, refreshed || transaction);
    return posted;
  } catch (error) {
    const failed = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE payment_intents
         SET posting_status = 'FAILED', failure_code = 'POSTING_FAILED', failure_message = $2,
             verification_status = 'VERIFIED',
             next_finalization_attempt_at = NOW() + (INTERVAL '30 seconds' * LEAST(finalization_attempts, 10)),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [intentId, String(error.message || "Payment posting failed").slice(0, 1000)],
      );
      if (rows[0]) await insertAudit(client, intentId, null, "BUSINESS_OPERATION_POSTING_FAILED", { message: error.message });
      return rows[0];
    });
    if (failed) emitPaymentChange(app, failed);
    throw error;
  }
};

export const recoverConfirmedPayments = async ({ app, limit = 100 } = {}) => {
  const { rows } = await db.query(
    `SELECT id FROM payment_intents
      WHERE payment_status = 'CONFIRMED' AND posting_status <> 'POSTED'
        AND (
          posting_status = 'PENDING'
          OR (posting_status = 'FAILED' AND (next_finalization_attempt_at IS NULL OR next_finalization_attempt_at <= NOW()))
          OR (posting_status = 'FINALIZING' AND updated_at < NOW() - INTERVAL '5 minutes')
        )
      ORDER BY confirmed_at ASC NULLS LAST LIMIT $1`,
    [Math.max(1, Math.min(Number(limit) || 100, 500))],
  );
  const results = [];
  for (const row of rows) {
    try {
      results.push(await finalizeConfirmedPayment({ app, intentId: row.id }));
    } catch (error) {
      console.error("Payment business-posting recovery failed", { intentId: row.id, message: error.message });
    }
  }
  return results.filter(Boolean);
};

export const getPaymentIntentForActor = async ({ salonId, actorId, reference, allowFinanceRole = false, fallback = null }) => {
  const { rows } = await db.query(
    `SELECT pi.*,
            CASE WHEN sba.id IS NULL THEN NULL ELSE json_build_object(
              'id', sba.id, 'bank_name', sba.bank_name, 'account_name', sba.account_name,
              'account_number', sba.account_number, 'currency', sba.currency,
              'branch_name', sba.branch_name, 'verification_mode', sba.verification_mode
            ) END AS bank_account
       FROM payment_intents pi
       LEFT JOIN salon_bank_accounts sba ON sba.id = pi.bank_account_id AND sba.salon_id = pi.salon_id
      WHERE pi.salon_id = $1 AND pi.intent_reference = $2
        AND ($4::boolean OR pi.initiated_by = $3)`,
    [salonId, reference, actorId, Boolean(allowFinanceRole)],
  );
  if (!rows[0] && !fallback) throw paymentError("Payment intent not found.", 404);
  return serializeIntent(rows[0] || fallback);
};
