import {
  acknowledgeAdvanceRequest,
  acknowledgeEmployeePayment,
  createAdvanceRequest,
  createPastAdvance,
  createEmployeePayment,
  createPastEmployeePayment,
  decideAdvanceRequest,
  decideEmployeePayment,
  disburseAdvanceRequest,
  disburseEmployeePayment,
  verifyAdvanceManualReceipt,
  verifyPaymentManualReceipt,
  acknowledgeAdvanceSettlement,
  getEmployeeFinanceReceipts,
  getEmployeeFinanceReceiptDetail,
  getEmployeeFinanceReceiptSignature,
  getEmployeeFinanceManualReceipt,
  getAdvanceRequestManualReceipt,
  getEmployeePaymentManualReceipt,
  listAdvanceRequests,
  listEmployeePayments,
  settleAdvanceRequest,
} from "../models/employeeFinanceOperationsModel.js";
import { sendPrivateArtifact } from "../utils/privateArtifactStorage.js";
import db from "../models/database.js";

const respond = (res, error) => {
  console.error("Employee finance operation failed:", error);
  return res.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : "Unable to complete the employee finance operation",
  });
};

const actor = (req) => ({
  salonId: req.salon_id,
  actorId: req.user.id,
  actorRole: req.user.role,
});

const emitFinanceChange = (req, action, record) => {
  const io = req.app.get("io") || global.io;
  if (!io || !req.salon_id) return;

  // Do not broadcast financial amounts or employee details. Clients refresh
  // the records through their existing role-protected endpoints.
  io.to(`salon:${req.salon_id}`).emit("employee-finance:changed", {
    action,
    recordId: record?.id || null,
    workflowStatus: record?.workflow_status || null,
    occurredAt: new Date().toISOString(),
  });
};

export const postAdvanceRequest = async (req, res) => {
  try {
    const request = await createAdvanceRequest({
      ...actor(req),
      employeeId: req.body?.employee_id,
      amount: req.body?.amount,
      reason: req.body?.reason,
    });
    emitFinanceChange(req, "advance-requested", request);
    res.status(201).json({ request });
  } catch (error) { respond(res, error); }
};

export const postPastAdvance = async (req, res) => {
  try {
    const request = await createPastAdvance({ ...actor(req), employeeId: req.body?.employee_id, amount: req.body?.amount,
      reason: req.body?.reason, occurredAt: req.body?.business_occurred_at, lateEntryReason: req.body?.late_entry_reason,
      manualReceiptDataUrl: req.body?.manual_receipt_data_url });
    emitFinanceChange(req, "past-advance-recorded", request);
    res.status(201).json({ request });
  } catch (error) { respond(res, error); }
};

export const getAdvanceRequests = async (req, res) => {
  try { res.json({ requests: await listAdvanceRequests(actor(req)) }); }
  catch (error) { respond(res, error); }
};

export const postAdvanceDecision = async (req, res) => {
  try {
    const request = await decideAdvanceRequest({
      ...actor(req), requestId: Number(req.params.id), approved: Boolean(req.body?.approved),
      rejectionReason: req.body?.rejection_reason,
      signatureDataUrl: req.body?.signature_data_url,
    });
    emitFinanceChange(req, "advance-reviewed", request);
    res.json({ request });
  } catch (error) { respond(res, error); }
};

export const postAdvanceDisbursement = async (req, res) => {
  try {
    const request = await disburseAdvanceRequest({ ...actor(req), requestId: Number(req.params.id) });
    emitFinanceChange(req, "advance-disbursed", request);
    res.json({ request });
  }
  catch (error) { respond(res, error); }
};

export const postAdvanceAcknowledgement = async (req, res) => {
  try {
    const request = await acknowledgeAdvanceRequest({ salonId: req.salon_id, actorId: req.user.id, requestId: Number(req.params.id), signatureDataUrl: req.body?.signature_data_url });
    emitFinanceChange(req, "advance-acknowledged", request);
    res.json({ request });
  }
  catch (error) { respond(res, error); }
};

export const postAdvanceManualReceiptVerification = async (req, res) => {
  try {
    const request = await verifyAdvanceManualReceipt({ ...actor(req), requestId: Number(req.params.id) });
    emitFinanceChange(req, "advance-paper-receipt-verified", request);
    res.json({ request });
  } catch (error) { respond(res, error); }
};

export const openAdvanceRequestPaperReceipt = async (req, res) => {
  try {
    return sendPrivateArtifact(res, await getAdvanceRequestManualReceipt({
      salonId: req.salon_id,
      requestId: Number(req.params.id),
    }));
  } catch (error) { return respond(res, error); }
};

export const postAdvanceSettlement = async (req, res) => {
  try {
    const settlement = await settleAdvanceRequest({
      ...actor(req),
      requestId: Number(req.params.id),
      amount: req.body?.amount,
      settlementMethod: req.body?.settlement_method,
      notes: req.body?.notes,
    });
    emitFinanceChange(req, "advance-settlement-recorded", settlement);
    res.status(201).json({ settlement });
  } catch (error) { respond(res, error); }
};

export const postAdvanceSettlementAcknowledgement = async (req, res) => {
  try {
    const settlement = await acknowledgeAdvanceSettlement({
      salonId: req.salon_id,
      actorId: req.user.id,
      requestId: Number(req.params.id),
      settlementId: Number(req.params.settlementId),
      signatureDataUrl: req.body?.signature_data_url,
    });
    emitFinanceChange(req, "advance-settlement-consented", settlement);
    res.json({ settlement });
  } catch (error) { respond(res, error); }
};

export const postEmployeePayment = async (req, res) => {
  try {
    const payment = await createEmployeePayment({
      ...actor(req), employeeId: req.body?.employee_id, periodId: req.body?.financial_period_id,
      amount: req.body?.amount, paymentMethod: req.body?.payment_method,
      paymentReference: req.body?.payment_reference, notes: req.body?.notes,
    });
    emitFinanceChange(req, "payment-requested", payment);
    res.status(201).json({ payment });
  } catch (error) { respond(res, error); }
};

export const postPastEmployeePayment = async (req, res) => {
  try {
    const payment = await createPastEmployeePayment({ ...actor(req), employeeId: req.body?.employee_id, amount: req.body?.amount,
      paymentMethod: req.body?.payment_method, paymentReference: req.body?.payment_reference, notes: req.body?.notes,
      occurredAt: req.body?.business_occurred_at, lateEntryReason: req.body?.late_entry_reason,
      manualReceiptDataUrl: req.body?.manual_receipt_data_url });
    emitFinanceChange(req, "past-payment-recorded", payment);
    res.status(201).json({ payment });
  } catch (error) { respond(res, error); }
};

export const getEmployeePayments = async (req, res) => {
  try { res.json({ payments: await listEmployeePayments(actor(req)) }); }
  catch (error) { respond(res, error); }
};

export const postPaymentDecision = async (req, res) => {
  try {
    const payment = await decideEmployeePayment({
      ...actor(req), paymentId: Number(req.params.id), approved: Boolean(req.body?.approved),
      rejectionReason: req.body?.rejection_reason,
      signatureDataUrl: req.body?.signature_data_url,
    });
    emitFinanceChange(req, "payment-reviewed", payment);
    res.json({ payment });
  } catch (error) { respond(res, error); }
};

export const postPaymentDisbursement = async (req, res) => {
  try {
    const payment = await disburseEmployeePayment({ ...actor(req), paymentId: Number(req.params.id) });
    emitFinanceChange(req, "payment-disbursed", payment);
    res.json({ payment });
  }
  catch (error) { respond(res, error); }
};

export const postPaymentAcknowledgement = async (req, res) => {
  try {
    const payment = await acknowledgeEmployeePayment({ salonId: req.salon_id, actorId: req.user.id, paymentId: Number(req.params.id), signatureDataUrl: req.body?.signature_data_url });
    emitFinanceChange(req, "payment-acknowledged", payment);
    res.json({ payment });
  }
  catch (error) { respond(res, error); }
};

export const postPaymentManualReceiptVerification = async (req, res) => {
  try {
    const payment = await verifyPaymentManualReceipt({ ...actor(req), paymentId: Number(req.params.id) });
    emitFinanceChange(req, "payment-paper-receipt-verified", payment);
    res.json({ payment });
  } catch (error) { respond(res, error); }
};

export const openEmployeePaymentPaperReceipt = async (req, res) => {
  try {
    return sendPrivateArtifact(res, await getEmployeePaymentManualReceipt({
      salonId: req.salon_id,
      paymentId: Number(req.params.id),
    }));
  } catch (error) { return respond(res, error); }
};

export const getFinanceReceipts = async (req, res) => {
  try { res.json({ receipts: await getEmployeeFinanceReceipts(actor(req)) }); }
  catch (error) { respond(res, error); }
};

export const getFinanceReceiptDetail = async (req, res) => {
  try {
    res.json(await getEmployeeFinanceReceiptDetail({
      ...actor(req), receiptId: Number(req.params.id),
    }));
  } catch (error) { respond(res, error); }
};

export const openFinanceReceiptPdf = async (req, res) => {
  try {
    const detail = await getEmployeeFinanceReceiptDetail({
      ...actor(req), receiptId: Number(req.params.id),
    });
    if (!detail.receipt.pdf_available) {
      return res.status(409).json({ error: "This receipt has not yet been fully signed and finalised." });
    }
    // The public view intentionally omits storage references. This lookup is
    // made only after the receipt-level permission check above.
    const { rows } = await db.query(
      "SELECT pdf_url FROM employee_finance_receipts WHERE id = $1 AND salon_id = $2",
      [Number(req.params.id), req.salon_id],
    );
    return sendPrivateArtifact(res, rows[0]?.pdf_url, { downloadName: `${detail.receipt.receipt_number}.pdf` });
  } catch (error) { return respond(res, error); }
};

export const openFinanceReceiptSignature = async (req, res) => {
  try {
    const reference = await getEmployeeFinanceReceiptSignature({
      ...actor(req), receiptId: Number(req.params.id), signatureId: Number(req.params.signatureId),
    });
    return sendPrivateArtifact(res, reference);
  } catch (error) { return respond(res, error); }
};

export const openFinanceManualReceipt = async (req, res) => {
  try { return sendPrivateArtifact(res, await getEmployeeFinanceManualReceipt({ ...actor(req), receiptId: Number(req.params.id) })); }
  catch (error) { return respond(res, error); }
};
