import dotenv from "dotenv";
import { fetchAllTagFees, fetchTagFeeById } from "../models/tagFeesModel.js";
import { deleteLinkedFee, recordLinkedFee, updateLinkedFee } from "../models/employeeFeeObligationsModel.js";
import { assertHistoricalRecordAccess, resolveBusinessDateTime } from "../utils/businessRecord.js";

dotenv.config();
const salonId = (req) => req.user?.salon_id || req.salon_id || Number(process.env.DEFAULT_SALON_ID);
const business = ({ body, user, existing }) => {
  const entry_type = body.entry_type || existing?.entry_type || "current";
  assertHistoricalRecordAccess({ user, entryType: entry_type, reason: body.backdate_reason ?? existing?.backdate_reason, label: "tag-fee" });
  if (existing && entry_type === "current") return { entryType: entry_type, feeDate: existing.fee_date, feeTime: existing.fee_time, backdateReason: null };
  const value = resolveBusinessDateTime({ entryType: entry_type, date: body.fee_date, time: body.fee_time, label: "tag-fee" });
  return { entryType: entry_type, feeDate: value.date, feeTime: value.time, backdateReason: entry_type === "past" ? String(body.backdate_reason).trim() : null };
};
const sendError = (res, err, fallback) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : fallback });
};

export const getAllTagFees = async (req, res) => { try { res.json(await fetchAllTagFees(salonId(req))); } catch (err) { sendError(res, err, "Failed to fetch tag fees"); } };
export const getTagFeeById = async (req, res) => {
  try {
    const data = await fetchTagFeeById(req.params.id, salonId(req));
    if (!data) return res.status(404).json({ error: "Tag fee not found" });
    res.json(data);
  } catch (err) { sendError(res, err, "Failed to fetch tag fee"); }
};
export const createTagFee = async (req, res) => {
  try {
    const data = await recordLinkedFee({ feeType: "TAG_FEE", salonId: salonId(req), actorId: req.user.id, employeeId: req.body.employee_id, amount: req.body.amount, reason: req.body.reason, ...business({ body: req.body, user: req.user }) });
    res.status(201).json({ message: "Tag fee created successfully and is awaiting settlement", data });
  } catch (err) { sendError(res, err, "Failed to create tag fee"); }
};
export const updateTagFeeById = async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await fetchTagFeeById(id, salonId(req));
    if (!existing) return res.status(404).json({ error: "Tag fee not found" });
    const data = await updateLinkedFee({ feeType: "TAG_FEE", id, salonId: salonId(req), employeeId: req.body.employee_id, amount: req.body.amount, reason: req.body.reason, ...business({ body: req.body, user: req.user, existing }) });
    res.json({ message: "Tag fee updated successfully", data });
  } catch (err) { sendError(res, err, "Failed to update tag fee"); }
};
export const deleteTagFeeById = async (req, res) => {
  try {
    const deleted = await deleteLinkedFee({ feeType: "TAG_FEE", id: req.params.id, salonId: salonId(req) });
    if (!deleted) return res.status(404).json({ error: "Tag fee not found" });
    res.json({ message: "Tag fee deleted successfully" });
  } catch (err) { sendError(res, err, "Failed to delete tag fee"); }
};
