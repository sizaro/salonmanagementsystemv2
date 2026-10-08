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
  listAdvanceRequests,
  listEmployeePayments,
  settleAdvanceRequest,
} from "../models/employeeFinanceOperationsModel.js";

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
    });
    res.json({ request });
  } catch (error) { respond(res, error); }
};

export const postAdvanceDisbursement = async (req, res) => {
  try { res.json({ request: await disburseAdvanceRequest({ ...actor(req), requestId: Number(req.params.id) }) }); }
  catch (error) { respond(res, error); }
};

export const postAdvanceAcknowledgement = async (req, res) => {
  try { res.json({ request: await acknowledgeAdvanceRequest({ salonId: req.salon_id, actorId: req.user.id, requestId: Number(req.params.id) }) }); }
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
    });
    res.json({ payment });
  } catch (error) { respond(res, error); }
};

export const postPaymentDisbursement = async (req, res) => {
  try { res.json({ payment: await disburseEmployeePayment({ ...actor(req), paymentId: Number(req.params.id) }) }); }
  catch (error) { respond(res, error); }
};

export const postPaymentAcknowledgement = async (req, res) => {
  try { res.json({ payment: await acknowledgeEmployeePayment({ salonId: req.salon_id, actorId: req.user.id, paymentId: Number(req.params.id) }) }); }
  catch (error) { respond(res, error); }
};

export const getFinanceReceipts = async (req, res) => {
  try { res.json({ receipts: await getEmployeeFinanceReceipts(actor(req)) }); }
  catch (error) { respond(res, error); }
};
