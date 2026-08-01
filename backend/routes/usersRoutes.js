import express from 'express';
const router = express.Router();

import { 
  getAllUsers,
  getUserById,
  createUser,
  updateUserById,
  deleteUserById
} from '../controllers/usersController.js';

import upload from "../middleware/upload.js";
import { requireAuth, requireRole, requireSalonContext } from "../middleware/auth.js";

router.use(requireAuth, requireSalonContext);

// GET all users
router.get('/', requireRole('owner', 'manager', 'cashier', 'employee', 'customer'), getAllUsers);

// GET single user by ID
router.get('/:id', requireRole('owner', 'manager', 'cashier', 'employee', 'customer'), getUserById);

// POST create a new user
router.post('/', requireRole('owner', 'manager'), upload.single("image_url"), createUser);

// PUT update an existing user by ID
router.put('/:id', requireRole('owner', 'manager'), upload.single("image_url"), updateUserById);

// DELETE remove a user by ID
router.delete('/:id', requireRole('owner'), deleteUserById);

export default router;
