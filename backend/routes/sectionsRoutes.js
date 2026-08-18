import express from 'express';
const router = express.Router();

import {
  getSections,
  getSection,
  createSection,
  updateSection,
  deleteSection,
} from '../controllers/sectionsController.js';
import { requireAuth, requireRole, requireSalonContext, requireOpenSalon } from "../middleware/auth.js";

router.use(requireAuth, requireSalonContext, requireOpenSalon);

// Fetch all sections
router.get('/', getSections);

// Fetch a single section by ID
router.get('/:id', getSection);

// Create a new section
router.post('/create', requireRole('owner', 'manager'), createSection);

// Update a section by ID
router.put('/:id', requireRole('owner', 'manager'), updateSection);

// Delete a section by ID
router.delete('/:id', requireRole('owner', 'manager'), deleteSection);

export default router;
