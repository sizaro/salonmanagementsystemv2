import { redisClient } from "../config/redis.js";

import express from 'express';
const router = express.Router();

import upload from "../middleware/upload.js"; // Multer middleware for file uploads
import { requireAuth, requireRole, requireSalonContext, requireOpenSalon } from "../middleware/auth.js";

import {
  // Service definitions
  getServiceDefinitions,
  getServiceDefinitionById,
  createServiceDefinition,
  updateServiceDefinition,
  deleteServiceDefinition,

  // Service roles
  getServiceRoles,

  getServiceMaterials,

  // Service transactions
  createServiceTransaction,
  getAllServiceTransactions,
  getServiceTransactionById,
  getAppointmentAvailability,
  updateServiceTransaction,
  updateServiceTransactiont,
  deleteServiceTransaction,
  updateServiceTransactionAppointment
} from '../controllers/servicesController.js';

router.use(requireAuth, requireSalonContext, requireOpenSalon);

// ===============================
// 🔵 SERVICE DEFINITIONS
// ===============================

// 👉 fetch all service definitions
router.get('/service_definitions', getServiceDefinitions);

// 👉 fetch a single service definition by ID
router.get('/service_definitions/:id', getServiceDefinitionById);

// 👉 create a service definition with optional image upload
router.post('/service_definitions/create', requireRole('owner', 'manager'), upload.single("service_image"), createServiceDefinition);

// 👉 update a service definition by ID with optional image upload
router.put('/service_definitions/:id', requireRole('owner', 'manager'), upload.single("service_image"), updateServiceDefinition);

// 👉 delete a service definition by ID
router.delete('/service_definitions/:id', requireRole('owner', 'manager'), deleteServiceDefinition);

// 👉 fetch all service roles
router.get('/service_roles', getServiceRoles);

// ===============================
// 🔵 SERVICE TRANSACTIONS
// ===============================

// 👉 create a service transaction + performers
router.post('/service_transactions', requireRole('owner', 'manager', 'cashier', 'customer'), createServiceTransaction);

// 👉 fetch all service transactions (with performers)
router.get('/service_transactions', getAllServiceTransactions);

// Privacy-safe availability: returns employee IDs only, never customer details.
router.get('/appointment-availability', getAppointmentAvailability);

// 👉 fetch single service transaction by ID
router.get('/service_transactions/:id', getServiceTransactionById);

// 👉 update a service transaction by ID
router.put('/service_transactions/:id', requireRole('owner', 'manager', 'cashier'), updateServiceTransaction);

// 👉 update a service transaction appointment
router.put('/service_transactions_appointment/:id', requireRole('owner', 'manager', 'cashier', 'customer'), updateServiceTransactionAppointment);

// 👉 update only the service timestamp for a transaction
router.put('/service_transactionst/:id', requireRole('owner', 'manager', 'cashier'), updateServiceTransactiont);

// 👉 delete a service transaction by ID
router.delete('/service_transactions/:id', requireRole('owner'), deleteServiceTransaction);

// 👉 fetch all service materials
router.get('/service_materials', getServiceMaterials);


export default router;
