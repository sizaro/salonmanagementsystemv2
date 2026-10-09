import express from 'express';
const router = express.Router();

import {
  getAllAdvances,
  getAdvanceById,
  createAdvance,
  updateAdvanceById,
  deleteAdvanceById,
} from '../controllers/advancesController.js';
import { requireAuth, requireRole, requireSalonContext } from "../middleware/auth.js";

// Legacy advance records are retained for historical/audit reporting only.
// New current advances must begin in Employee Finance so approval, disbursement,
// acknowledgement and settlement cannot be bypassed.
router.use(requireAuth, requireSalonContext);

// GET all advances
router.get('/', requireRole('owner', 'manager', 'cashier'), getAllAdvances);

// GET single advance by ID
router.get('/:id', requireRole('owner', 'manager', 'cashier'), getAdvanceById);

// POST create new advance
router.post('/', requireRole('owner'), createAdvance);

// PUT update advance by ID
router.put('/:id', requireRole('owner', 'manager'), updateAdvanceById);

// DELETE remove advance by ID
router.delete('/:id', requireRole('owner', 'manager'), deleteAdvanceById);

export default router;
