import express from "express";
import { requireRole } from "../middleware/auth.js";
import { getEmployeeProfileById, openEmployeeDocument } from "../controllers/employeeProfileController.js";

const router = express.Router();

router.get("/:id", requireRole("owner", "manager", "cashier", "employee"), getEmployeeProfileById);
router.get("/:id/documents/:kind", requireRole("owner", "manager", "cashier", "employee"), openEmployeeDocument);

export default router;
