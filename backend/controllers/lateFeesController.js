import dotenv from "dotenv";
dotenv.config();

import { 
  saveLateFee, 
  fetchAllLateFees, 
  fetchLateFeeById, 
  UpdateLateFeeById,
  DeleteLateFeeById 
} from "../models/lateFeesModel.js";


const resolveSalonId = (req) => {
  return (
    req.user?.salon_id ||
    req.salon_id ||
    Number(process.env.DEFAULT_SALON_ID)
  );
};

/**
 * Get all late fees for the salon
 */
export const getAllLateFees = async (req, res) => {
  try {
    const salon_id = resolveSalonId(req);
    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const lateFees = await fetchAllLateFees(salon_id);
    res.status(200).json(lateFees);
  } catch (err) {
    console.error("Error fetching late fees:", err);
    res.status(500).json({ error: "Failed to fetch late fees" });
  }
};

/**
 * Get late fee by ID (for the salon)
 */
export const getLateFeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = resolveSalonId(req);

    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const lateFee = await fetchLateFeeById(id, salon_id);
    if (!lateFee) {
      return res.status(404).json({ error: "Late fee not found" });
    }

    res.status(200).json(lateFee);
  } catch (err) {
    console.error("Error fetching late fee by ID:", err);
    res.status(500).json({ error: "Failed to fetch late fee" });
  }
};

/**
 * Create new late fee
 */
export const createLateFee = async (req, res) => {
  try {
    const { employee_id, amount, reason } = req.body;
    const salon_id = resolveSalonId(req);

    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    console.log("Creating late fee:", {
      employee_id,
      amount,
      salon_id
    });

    const newLateFee = await saveLateFee({
      employee_id,
      amount,
      reason,
      salon_id
    });

    res.status(201).json({
      message: "Late fee created successfully",
      data: newLateFee
    });
  } catch (err) {
    console.error("Error creating late fee:", err);
    res.status(500).json({ error: "Failed to create late fee" });
  }
};

/**
 * Update late fee by ID
 */
export const updateLateFeeById = async (req, res) => {
  try {
    const { id, employee_id, amount, reason, created_at } = req.body;
    const salon_id = resolveSalonId(req);

    if (!id) {
      return res.status(400).json({ error: "Missing late fee ID" });
    }

    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const updatedLateFee = await UpdateLateFeeById({
      id,
      employee_id,
      amount,
      reason,
      created_at,
      salon_id
    });

    if (!updatedLateFee) {
      return res.status(404).json({ error: "Late fee not found or not updated" });
    }

    res.status(200).json({
      message: "Late fee updated successfully",
      data: updatedLateFee
    });
  } catch (err) {
    console.error("Error updating late fee:", err);
    res.status(500).json({ error: "Failed to update late fee" });
  }
};

/**
 * Delete late fee by ID
 */
export const deleteLateFeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = resolveSalonId(req);

    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const deleted = await DeleteLateFeeById(id, salon_id);
    if (!deleted) {
      return res.status(404).json({ error: "Late fee not found" });
    }

    res.status(200).json({ message: "Late fee deleted successfully" });
  } catch (err) {
    console.error("Error deleting late fee:", err);
    res.status(500).json({ error: "Failed to delete late fee" });
  }
};

export default {
  getAllLateFees,
  getLateFeeById,
  createLateFee,
  updateLateFeeById,
  deleteLateFeeById
};
