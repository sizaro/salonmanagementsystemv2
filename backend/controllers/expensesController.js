import dotenv from "dotenv";
dotenv.config();

import { 
  saveExpense, 
  fetchAllExpenses, 
  fetchExpenseById, 
  UpdateExpenseById, 
  DeleteExpenseById 
} from "../models/expensesModel.js";


const resolveSalonId = (req) => {
  return (
    req.user?.salon_id ||
    req.salon_id ||
    Number(process.env.DEFAULT_SALON_ID)
  );
};

/**
 * Get all expenses
 */
export const getAllExpenses = async (req, res) => {
  try {
    const salon_id = resolveSalonId(req);
    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const expenses = await fetchAllExpenses(salon_id);
    res.status(200).json(expenses);
  } catch (err) {
    console.error("Error fetching expenses:", err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
};

/**
 * Get expense by ID
 */
export const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = resolveSalonId(req);

    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const expense = await fetchExpenseById(id, salon_id);
    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.status(200).json(expense);
  } catch (err) {
    console.error("Error fetching expense by ID:", err);
    res.status(500).json({ error: "Failed to fetch expense" });
  }
};

/**
 * Create new expense
 */
export const createExpense = async (req, res) => {
  try {
    const { name, amount, description } = req.body;
    const salon_id = resolveSalonId(req);

    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    console.log("Creating expense:", { name, amount, salon_id });

    const newExpense = await saveExpense({
      name,
      amount,
      description,
      salon_id
    });

    res.status(201).json({
      message: "Expense created successfully",
      data: newExpense
    });
  } catch (err) {
    console.error("Error creating expense:", err);
    res.status(500).json({ error: "Failed to create expense" });
  }
};

/**
 * Update expense by ID
 */
export const updateExpenseById = async (req, res) => {
  try {
    const { id, name, amount, description, created_at } = req.body;
    const salon_id = resolveSalonId(req);

    if (!id) {
      return res.status(400).json({ error: "Missing expense ID" });
    }

    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const updatedExpense = await UpdateExpenseById({
      id,
      name,
      amount,
      description,
      created_at,
      salon_id
    });

    if (!updatedExpense) {
      return res.status(404).json({ error: "Expense not found or not updated" });
    }

    res.status(200).json({
      message: "Expense updated successfully",
      data: updatedExpense
    });
  } catch (err) {
    console.error("Error updating expense:", err);
    res.status(500).json({ error: "Failed to update expense" });
  }
};

/**
 * Delete expense by ID
 */
export const deleteExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = resolveSalonId(req);

    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const deleted = await DeleteExpenseById(id, salon_id);
    if (!deleted) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.status(200).json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error("Error deleting expense:", err);
    res.status(500).json({ error: "Failed to delete expense" });
  }
};

export default {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpenseById,
  deleteExpenseById
};
