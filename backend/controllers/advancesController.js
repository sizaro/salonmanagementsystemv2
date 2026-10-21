import {
  fetchAllAdvances,
  fetchAdvanceById,
  isFinanceWorkflowAdvance,
  UpdateAdvanceById,
  DeleteAdvanceById,
} from "../models/advancesModel.js";

const getSalonId = (req) => Number(req.salon_id || req.user?.salon_id);

/**
 * Get all advances
 */
export const getAllAdvances = async (req, res) => {
  try {
    const salon_id = getSalonId(req);
    const advances = await fetchAllAdvances(salon_id);
    res.status(200).json(advances);
  } catch (err) {
    console.error("Error fetching advances:", err);
    res.status(500).json({ error: "Failed to fetch advances" });
  }
};

/**
 * Get advance by ID
 */
export const getAdvanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = getSalonId(req);

    const advance = await fetchAdvanceById(id, salon_id);
    if (!advance) return res.status(404).json({ error: "Advance not found" });

    res.status(200).json(advance);
  } catch (err) {
    console.error("Error fetching advance by ID:", err);
    res.status(500).json({ error: "Failed to fetch advance" });
  }
};

/**
 * Create new advance
 */
export const createAdvance = async (req, res) => {
  try {
    return res.status(409).json({
      error:
        "New advances, including past entries, must be recorded through Employee Finance so approval, disbursement, receipt evidence, and settlement are recorded.",
      code: "USE_EMPLOYEE_FINANCE_WORKFLOW",
    });
  } catch (err) {
    console.error("Error creating advance:", err);

    res.status(500).json({
      error: err.message || "Failed to create advance",
    });
  }
};

/**
 * Update advance by ID
 */
export const updateAdvanceById = async (req, res) => {
  try {
    const salon_id = getSalonId(req);
    const { id } = req.params;
    const { employee_id, amount, description, advance_date, advance_time, backdate_reason } = req.body;

    if (!id) return res.status(400).json({ error: "Missing advance ID" });

    const existing = await fetchAdvanceById(id, salon_id);
    if (!existing) return res.status(404).json({ error: "Advance not found" });

    if (await isFinanceWorkflowAdvance(id, salon_id)) {
      return res.status(409).json({
        error: "This advance was issued through the employee finance workflow and cannot be edited. Use a finance correction record instead.",
      });
    }

    if (existing.entry_type === "past" && req.user?.role !== "owner") {
      return res.status(403).json({ error: "Only owners can edit past advances" });
    }

    if (existing.entry_type === "past" && !String(backdate_reason ?? existing.backdate_reason ?? "").trim()) {
      return res.status(400).json({ error: "A backdate reason is required for a past advance" });
    }

    const updatedAdvance = await UpdateAdvanceById({
      id,
      employee_id,
      amount,
      description,
      // Current records retain the server-created business timestamp. Only
      // an owner editing an existing historical record may adjust it.
      advance_date: existing.entry_type === "past" ? advance_date : undefined,
      advance_time: existing.entry_type === "past" ? advance_time : undefined,
      backdate_reason: existing.entry_type === "past" ? String(backdate_reason ?? existing.backdate_reason).trim() : null,
      salon_id,
    });

    if (!updatedAdvance)
      return res
        .status(404)
        .json({ error: "Advance not found or not updated" });

    res
      .status(200)
      .json({ message: "Advance updated successfully", data: updatedAdvance });
  } catch (err) {
    console.error("Error updating advance:", err);
    res.status(500).json({ error: "Failed to update advance" });
  }
};

/**
 * Delete advance by ID
 */
export const deleteAdvanceById = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = getSalonId(req);

    if (await isFinanceWorkflowAdvance(id, salon_id)) {
      return res.status(409).json({
        error: "This advance was issued through the employee finance workflow and cannot be deleted.",
      });
    }

    const deleted = await DeleteAdvanceById(id, salon_id);
    if (!deleted) return res.status(404).json({ error: "Advance not found" });

    res.status(200).json({ message: "Advance deleted successfully" });
  } catch (err) {
    console.error("Error deleting advance:", err);
    res.status(500).json({ error: "Failed to delete advance" });
  }
};

export default {
  getAllAdvances,
  getAdvanceById,
  createAdvance,
  updateAdvanceById,
  deleteAdvanceById,
};
