import express from 'express';
const router = express.Router();

import {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpenseById,
  deleteExpenseById,
} from '../controllers/expensesController.js';
import { requireRole } from "../middleware/auth.js";

// GET all expenses
router.get('/', getAllExpenses);

// GET single expense by ID
router.get('/:id', getExpenseById);

// POST create new expense
router.post('/', createExpense);

// PUT update expense by ID
router.put('/:id', requireRole('owner', 'manager'), updateExpenseById);

// DELETE remove expense by ID
router.delete('/:id', requireRole('owner', 'manager'), deleteExpenseById);

export default router;
