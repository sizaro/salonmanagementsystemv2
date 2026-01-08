import { 
  saveAdvance, 
  fetchAllAdvances, 
  fetchAdvanceById, 
  UpdateAdvanceById, 
  DeleteAdvanceById 
} from "../models/advancesModel.js";

import dotenv from "dotenv";

const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenv.config({ path: envFile });

console.log("Loaded env:", envFile);

// Helper: get salon_id from req.user if available, else use env default
const getSalonId = (req) => Number(req.user?.salon_id || process.env.DEFAULT_SALON_ID);

/**
 * Get all advances
 */
export const getAllAdvances = async (req, res) => {
  try {
    const salon_id = getSalonId(req);
    const advances = await fetchAllAdvances(salon_id);
    res.status(200).json(advances);
  } catch (err) {
    console.error('Error fetching advances:', err);
    res.status(500).json({ error: 'Failed to fetch advances' });
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
    const salon_id = getSalonId(req);
    const { employee_id, amount, description } = req.body;

    const newAdvance = await saveAdvance({
      employee_id,
      amount,
      description,
      salon_id
    });

    res.status(201).json({ message: "Advance created successfully", data: newAdvance });
  } catch (err) {
    console.error("Error creating advance:", err);
    res.status(500).json({ error: "Failed to create advance" });
  }
};

/**
 * Update advance by ID
 */
export const updateAdvanceById = async (req, res) => {
  try {
    const salon_id = getSalonId(req);
    const { id, employee_id, amount, description, created_at } = req.body;

    if (!id) return res.status(400).json({ error: "Missing advance ID" });

    const updatedAdvance = await UpdateAdvanceById({
      id,
      employee_id,
      amount,
      description,
      created_at,
      salon_id
    });

    if (!updatedAdvance) return res.status(404).json({ error: "Advance not found or not updated" });

    res.status(200).json({ message: "Advance updated successfully", data: updatedAdvance });
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
  deleteAdvanceById
};
