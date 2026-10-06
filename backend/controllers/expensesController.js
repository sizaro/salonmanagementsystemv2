import dotenv from "dotenv";
import { saveExpense, fetchAllExpenses, fetchExpenseById, UpdateExpenseById, DeleteExpenseById } from "../models/expensesModel.js";
import { assertHistoricalRecordAccess, resolveBusinessDateTime } from "../utils/businessRecord.js";
dotenv.config();

const resolveSalonId = (req) => req.user?.salon_id || req.salon_id || Number(process.env.DEFAULT_SALON_ID);

const businessValues = ({ body, user, existing }) => {
  const entry_type = body.entry_type || existing?.entry_type || "current";
  assertHistoricalRecordAccess({ user, entryType: entry_type, reason: body.backdate_reason ?? existing?.backdate_reason, label: "expense" });
  if (existing && entry_type === "current") return { entry_type, expense_date: existing.expense_date, expense_time: existing.expense_time, backdate_reason: null };
  const value = resolveBusinessDateTime({ entryType: entry_type, date: body.expense_date, time: body.expense_time, label: "expense" });
  return { entry_type, expense_date: value.date, expense_time: value.time, backdate_reason: entry_type === "past" ? String(body.backdate_reason).trim() : null };
};

export const getAllExpenses = async (req, res) => {
  try { const salon_id = resolveSalonId(req); if (!salon_id) return res.status(400).json({ error: "Salon context missing" }); res.status(200).json(await fetchAllExpenses(salon_id)); }
  catch (err) { console.error("Error fetching expenses:", err); res.status(500).json({ error: "Failed to fetch expenses" }); }
};
export const getExpenseById = async (req, res) => {
  try { const expense = await fetchExpenseById(req.params.id, resolveSalonId(req)); if (!expense) return res.status(404).json({ error: "Expense not found" }); res.status(200).json(expense); }
  catch (err) { console.error("Error fetching expense:", err); res.status(500).json({ error: "Failed to fetch expense" }); }
};
export const createExpense = async (req, res) => {
  try {
    const salon_id = resolveSalonId(req); if (!salon_id) return res.status(400).json({ error: "Salon context missing" });
    const data = await saveExpense({ name: req.body.name, amount: req.body.amount, description: req.body.description, salon_id, ...businessValues({ body: req.body, user: req.user }) });
    res.status(201).json({ message: "Expense created successfully", data });
  } catch (err) { console.error("Error creating expense:", err); res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Failed to create expense" }); }
};
export const updateExpenseById = async (req, res) => {
  try {
    const salon_id = resolveSalonId(req); const existing = await fetchExpenseById(req.params.id, salon_id);
    if (!existing) return res.status(404).json({ error: "Expense not found" });
    const data = await UpdateExpenseById({ id: req.params.id, name: req.body.name, amount: req.body.amount, description: req.body.description, salon_id, ...businessValues({ body: req.body, user: req.user, existing }) });
    res.status(200).json({ message: "Expense updated successfully", data });
  } catch (err) { console.error("Error updating expense:", err); res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : "Failed to update expense" }); }
};
export const deleteExpenseById = async (req, res) => {
  try { const deleted = await DeleteExpenseById(req.params.id, resolveSalonId(req)); if (!deleted) return res.status(404).json({ error: "Expense not found" }); res.status(200).json({ message: "Expense deleted successfully" }); }
  catch (err) { console.error("Error deleting expense:", err); res.status(500).json({ error: "Failed to delete expense" }); }
};
export default { getAllExpenses, getExpenseById, createExpense, updateExpenseById, deleteExpenseById };
