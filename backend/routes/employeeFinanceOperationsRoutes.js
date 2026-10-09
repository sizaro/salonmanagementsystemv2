import express from "express";
import {
  getAdvanceRequests,
  getEmployeePayments,
  getFinanceReceiptDetail,
  getFinanceReceipts,
  openFinanceReceiptPdf,
  openFinanceReceiptSignature,
  postAdvanceAcknowledgement,
  postAdvanceDecision,
  postAdvanceDisbursement,
  postAdvanceRequest,
  postAdvanceSettlement,
  postEmployeePayment,
  postPaymentAcknowledgement,
  postPaymentDecision,
  postPaymentDisbursement,
} from "../controllers/employeeFinanceOperationsController.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/advance-requests", requireRole("owner", "manager", "cashier", "employee"), getAdvanceRequests);
router.post("/advance-requests", requireRole("owner", "manager", "cashier", "employee"), postAdvanceRequest);
router.post("/advance-requests/:id/decision", requireRole("owner", "manager"), postAdvanceDecision);
router.post("/advance-requests/:id/disburse", requireRole("owner", "manager", "cashier"), postAdvanceDisbursement);
router.post("/advance-requests/:id/acknowledge", requireRole("employee", "manager", "cashier"), postAdvanceAcknowledgement);
router.post("/advance-requests/:id/settlements", requireRole("owner", "manager"), postAdvanceSettlement);

router.get("/payments", requireRole("owner", "manager", "cashier", "employee"), getEmployeePayments);
router.post("/payments", requireRole("owner", "manager", "cashier"), postEmployeePayment);
router.post("/payments/:id/decision", requireRole("owner", "manager"), postPaymentDecision);
router.post("/payments/:id/disburse", requireRole("owner", "manager", "cashier"), postPaymentDisbursement);
router.post("/payments/:id/acknowledge", requireRole("employee", "manager", "cashier"), postPaymentAcknowledgement);

router.get("/receipts", requireRole("owner", "manager", "cashier", "employee"), getFinanceReceipts);
router.get("/receipts/:id", requireRole("owner", "manager", "cashier", "employee"), getFinanceReceiptDetail);
router.get("/receipts/:id/pdf", requireRole("owner", "manager", "cashier", "employee"), openFinanceReceiptPdf);
router.get("/receipts/:id/signatures/:signatureId", requireRole("owner", "manager", "cashier", "employee"), openFinanceReceiptSignature);

export default router;
