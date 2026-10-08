import express from "express";
import { requireRole } from "../middleware/auth.js";
import {
  getEmployeeFinanceOverviewById,
  getEmployeeFinancePeriods,
  getMyEmployeeFinanceOverview,
  getSalonFinanceSummaryController,
  postEmployeeFinancePeriod,
} from "../controllers/employeeFinanceController.js";

const router = express.Router();

router.get(
  "/summary",
  requireRole("owner", "manager", "cashier"),
  getSalonFinanceSummaryController,
);
router.get(
  "/me/overview",
  requireRole("owner", "manager", "cashier", "employee"),
  getMyEmployeeFinanceOverview,
);
router.get(
  "/employees/:employeeId/overview",
  requireRole("owner", "manager", "cashier"),
  getEmployeeFinanceOverviewById,
);
router.get(
  "/periods",
  requireRole("owner", "manager", "cashier"),
  getEmployeeFinancePeriods,
);
router.post(
  "/periods",
  requireRole("owner", "manager"),
  postEmployeeFinancePeriod,
);

export default router;
