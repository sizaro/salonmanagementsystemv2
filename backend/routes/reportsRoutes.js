import express from 'express'
const router = express.Router();
import {getDailyReport }from '../controllers/dailyController.js';
import {getWeeklyReport }from '../controllers/weeklyController.js';
import {getMonthlyReport }from '../controllers/monthlyController.js';
import { getYearlyReport } from "../controllers/yearlyController.js";
import { getReport, getCashierIncomeReview, getCashierPayroll, getMyPayroll, getMyIncomeReport, getEmployeeReport, getEmployeeReportEmployees, getMyEmployeeReport, exportEmployeeReportCsv } from "../controllers/reportsController.js";
import { requireRole } from "../middleware/auth.js";


router.get('/daily', requireRole('owner', 'manager'), getDailyReport);
router.get('/weekly', requireRole('owner', 'manager'), getWeeklyReport);
router.get('/monthly', requireRole('owner', 'manager'), getMonthlyReport);
router.get("/yearly", requireRole('owner', 'manager'), getYearlyReport);
router.get("/payroll", requireRole('owner', 'manager', 'cashier'), getCashierPayroll);
router.get("/cashier-income", requireRole('cashier', 'manager'), getCashierIncomeReview);
router.get("/my-payroll", requireRole('employee', 'manager', 'cashier'), getMyPayroll);
router.get("/my-income", requireRole('employee'), getMyIncomeReport);
router.get("/my-employee-report/export", requireRole('employee'), exportEmployeeReportCsv);
router.get("/my-employee-report", requireRole('employee'), getMyEmployeeReport);
router.get("/employees", requireRole('owner', 'manager'), getEmployeeReportEmployees);
router.get("/employees/:employeeId/export", requireRole('owner', 'manager'), exportEmployeeReportCsv);
router.get("/employees/:employeeId", requireRole('owner', 'manager'), getEmployeeReport);
router.get("/", requireRole('owner', 'manager'), getReport);

export default router

