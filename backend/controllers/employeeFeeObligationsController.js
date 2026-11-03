import {
  acknowledgeFeePayrollDeduction,
  createCleanerFeeObligations,
  listFeeObligations,
  settleFeeObligation,
  updateCleanerFeeObligation,
  voidCleanerFeeObligation,
} from "../models/employeeFeeObligationsModel.js";

const actor = (req) => ({ salonId: req.salon_id, actorId: req.user.id, actorRole: req.user.role });
const respond = (res, err) => {
  console.error("Employee fee operation failed:", err);
  return res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Unable to complete the employee fee operation" });
};
const changed = (req, action, id = null) => req.app.get("io")?.to(`salon:${req.salon_id}`).emit("employee-finance:changed", { action, recordId: id, occurredAt: new Date().toISOString() });

export const getFeeObligations = async (req, res) => {
  try { res.json({ obligations: await listFeeObligations(actor(req)) }); } catch (err) { respond(res, err); }
};
export const postCleanerFees = async (req, res) => {
  try {
    const result = await createCleanerFeeObligations({ ...actor(req), employeeIds: req.body?.employee_ids, amount: req.body?.amount, feePeriod: req.body?.fee_period, reason: req.body?.reason });
    changed(req, "cleaner-fees-assigned");
    res.status(201).json({ result });
  } catch (err) { respond(res, err); }
};
export const patchCleanerFee = async (req, res) => {
  try {
    const obligation = await updateCleanerFeeObligation({ ...actor(req), obligationId: Number(req.params.id), amount: req.body?.amount, reason: req.body?.reason });
    changed(req, "cleaner-fee-updated", obligation.id);
    res.json({ obligation });
  } catch (err) { respond(res, err); }
};
export const deleteCleanerFee = async (req, res) => {
  try {
    const obligation = await voidCleanerFeeObligation({ ...actor(req), obligationId: Number(req.params.id), reason: req.body?.reason });
    changed(req, "cleaner-fee-voided", obligation.id);
    res.json({ obligation });
  } catch (err) { respond(res, err); }
};
export const postFeeSettlement = async (req, res) => {
  try {
    const settlement = await settleFeeObligation({ ...actor(req), obligationId: Number(req.params.id), amount: req.body?.amount, settlementMethod: req.body?.settlement_method, notes: req.body?.notes, signatureDataUrl: req.body?.settlement_signature_data_url });
    changed(req, "fee-settlement-recorded", settlement.id);
    res.status(201).json({ settlement });
  } catch (err) { respond(res, err); }
};
export const postFeeDeductionConsent = async (req, res) => {
  try {
    const settlement = await acknowledgeFeePayrollDeduction({ salonId: req.salon_id, actorId: req.user.id, obligationId: Number(req.params.id), settlementId: Number(req.params.settlementId), signatureDataUrl: req.body?.signature_data_url });
    changed(req, "fee-deduction-consented", settlement.id);
    res.json({ settlement });
  } catch (err) { respond(res, err); }
};
