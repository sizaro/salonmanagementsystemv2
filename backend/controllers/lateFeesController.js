import dotenv from "dotenv";
import { fetchAllLateFees, fetchLateFeeById } from "../models/lateFeesModel.js";
import { deleteLinkedFee, recordLinkedFee, updateLinkedFee } from "../models/employeeFeeObligationsModel.js";
import { assertHistoricalRecordAccess, resolveBusinessDateTime } from "../utils/businessRecord.js";

dotenv.config();
const salonId = (req) => req.user?.salon_id || req.salon_id || Number(process.env.DEFAULT_SALON_ID);
const business = ({ body, user, existing }) => {
  const entry_type = body.entry_type || existing?.entry_type || "current";
  assertHistoricalRecordAccess({ user, entryType: entry_type, reason: body.backdate_reason ?? existing?.backdate_reason, label: "late-fee" });
  if (existing && entry_type === "current") return { entryType: entry_type, feeDate: existing.fee_date, feeTime: existing.fee_time, backdateReason: null };
  const value = resolveBusinessDateTime({ entryType: entry_type, date: body.fee_date, time: body.fee_time, label: "late-fee" });
  return { entryType: entry_type, feeDate: value.date, feeTime: value.time, backdateReason: entry_type === "past" ? String(body.backdate_reason).trim() : null };
};
const sendError = (res, err, fallback) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : fallback });
};

export const getAllLateFees = async (req, res) => {
  try { res.json(await fetchAllLateFees(salonId(req))); } catch (err) { sendError(res, err, "Failed to fetch late fees"); }
};
export const getLateFeeById = async (req, res) => {
  try {
    const data = await fetchLateFeeById(req.params.id, salonId(req));
    if (!data) return res.status(404).json({ error: "Late fee not found" });
    res.json(data);
  } catch (err) { sendError(res, err, "Failed to fetch late fee"); }
};
export const createLateFee = async (req, res) => {
  try {
    const data = await recordLinkedFee({ feeType: "LATE_FEE", salonId: salonId(req), actorId: req.user.id, employeeId: req.body.employee_id, amount: req.body.amount, reason: req.body.reason, ...business({ body: req.body, user: req.user }) });
    res.status(201).json({ message: "Late fee created successfully and is awaiting settlement", data });
  } catch (err) { sendError(res, err, "Failed to create late fee"); }
};
export const updateLateFeeById = async (req, res) => {
  try {
    const id = req.params.id;
    const existing = await fetchLateFeeById(id, salonId(req));
    if (!existing) return res.status(404).json({ error: "Late fee not found" });
    const data = await updateLinkedFee({ feeType: "LATE_FEE", id, salonId: salonId(req), employeeId: req.body.employee_id, amount: req.body.amount, reason: req.body.reason, ...business({ body: req.body, user: req.user, existing }) });
    res.json({ message: "Late fee updated successfully", data });
  } catch (err) { sendError(res, err, "Failed to update late fee"); }
};
export const deleteLateFeeById = async (req, res) => {
  try {
    const deleted = await deleteLinkedFee({ feeType: "LATE_FEE", id: req.params.id, salonId: salonId(req) });
    if (!deleted) return res.status(404).json({ error: "Late fee not found" });
    res.json({ message: "Late fee deleted successfully" });
  } catch (err) { sendError(res, err, "Failed to delete late fee"); }
};
