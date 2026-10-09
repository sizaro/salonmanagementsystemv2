import {
  acknowledgeAdvanceRequest,
  acknowledgeEmployeePayment,
  createAdvanceRequest,
  createEmployeePayment,
  decideAdvanceRequest,
  decideEmployeePayment,
  disburseAdvanceRequest,
  disburseEmployeePayment,
  getEmployeeFinanceReceipts,
  getEmployeeFinanceReceiptDetail,
  getEmployeeFinanceReceiptSignature,
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

export const postAdvanceRequest = async (req, res) => {
  try {
    const request = await createAdvanceRequest({
      ...actor(req),
      employeeId: req.body?.employee_id,
      amount: req.body?.amount,
      reason: req.body?.reason,
    });
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
    res.json({ request });
  } catch (error) { respond(res, error); }
};

export const postAdvanceDisbursement = async (req, res) => {
  try { res.json({ request: await disburseAdvanceRequest({ ...actor(req), requestId: Number(req.params.id) }) }); }
  catch (error) { respond(res, error); }
};

export const postAdvanceAcknowledgement = async (req, res) => {
  try { res.json({ request: await acknowledgeAdvanceRequest({ salonId: req.salon_id, actorId: req.user.id, requestId: Number(req.params.id), signatureDataUrl: req.body?.signature_data_url }) }); }
  catch (error) { respond(res, error); }
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
    res.status(201).json({ settlement });
  } catch (error) { respond(res, error); }
};

export const postEmployeePayment = async (req, res) => {
  try {
    const payment = await createEmployeePayment({
      ...actor(req), employeeId: req.body?.employee_id, periodId: req.body?.financial_period_id,
      amount: req.body?.amount, paymentMethod: req.body?.payment_method,
      paymentReference: req.body?.payment_reference, notes: req.body?.notes,
    });
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
    res.json({ payment });
  } catch (error) { respond(res, error); }
};

export const postPaymentDisbursement = async (req, res) => {
  try { res.json({ payment: await disburseEmployeePayment({ ...actor(req), paymentId: Number(req.params.id) }) }); }
  catch (error) { respond(res, error); }
};

export const postPaymentAcknowledgement = async (req, res) => {
  try { res.json({ payment: await acknowledgeEmployeePayment({ salonId: req.salon_id, actorId: req.user.id, paymentId: Number(req.params.id), signatureDataUrl: req.body?.signature_data_url }) }); }
  catch (error) { respond(res, error); }
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
