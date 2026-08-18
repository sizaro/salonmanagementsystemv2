import express from 'express'
const router = express.Router();
import {getDailyReport }from '../controllers/dailyController.js';
import {getWeeklyReport }from '../controllers/weeklyController.js';
import {getMonthlyReport }from '../controllers/monthlyController.js';
import { getYearlyReport } from "../controllers/yearlyController.js";
import { getReport, getCashierIncomeReview, getCashierPayroll, getMyPayroll, getMyIncomeReport } from "../controllers/reportsController.js";
import { requireRole } from "../middleware/auth.js";


router.get('/daily', requireRole('owner', 'manager'), getDailyReport);
router.get('/weekly', requireRole('owner', 'manager'), getWeeklyReport);
router.get('/monthly', requireRole('owner', 'manager'), getMonthlyReport);
router.get("/yearly", requireRole('owner', 'manager'), getYearlyReport);
router.get("/payroll", requireRole('owner', 'manager', 'cashier'), getCashierPayroll);
router.get("/cashier-income", requireRole('cashier'), getCashierIncomeReview);
router.get("/my-payroll", requireRole('employee', 'manager', 'cashier'), getMyPayroll);
router.get("/my-income", requireRole('employee'), getMyIncomeReport);
router.get("/", requireRole('owner', 'manager'), getReport);

export default router

