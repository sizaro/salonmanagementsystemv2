import express from 'express';
const router = express.Router();

import { 
  getAllUsers,
  getBookableStaff,
  getUserById,
  createUser,
  registerCustomer,
  updateUserById,
  deleteUserById
} from '../controllers/usersController.js';

import upload from "../middleware/upload.js";
import { requireAuth, requireRole, requireSalonContext, requireOpenSalon } from "../middleware/auth.js";

// Public customer self-registration. Authentication and an open salon are not
// required; the controller always forces the role to "customer".
router.post('/register-customer', upload.single("image_url"), registerCustomer);

router.use(requireAuth, requireSalonContext, requireOpenSalon);

// Safe public staff fields used by the customer booking screen.
router.get('/bookable-staff', requireRole('owner', 'manager', 'cashier', 'employee', 'customer'), getBookableStaff);

// GET all users
router.get('/', requireRole('owner', 'manager', 'cashier', 'employee'), getAllUsers);

// GET single user by ID
router.get('/:id', requireRole('owner', 'manager', 'cashier', 'employee'), getUserById);

// POST create a new user
router.post('/', requireRole('owner', 'manager'), upload.single("image_url"), createUser);

// PUT update an existing user by ID
router.put('/:id', requireRole('owner', 'manager'), upload.single("image_url"), updateUserById);

// DELETE remove a user by ID
router.delete('/:id', requireRole('owner'), deleteUserById);

export default router;
