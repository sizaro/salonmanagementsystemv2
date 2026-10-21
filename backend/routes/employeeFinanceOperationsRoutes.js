import express from "express";
import {
  getAdvanceRequests,
  getEmployeePayments,
  getFinanceReceiptDetail,
  getFinanceReceipts,
  openFinanceReceiptPdf,
  openFinanceReceiptSignature,
  openFinanceManualReceipt,
  openAdvanceRequestPaperReceipt,
  openEmployeePaymentPaperReceipt,
  postAdvanceAcknowledgement,
  postAdvanceDecision,
  postAdvanceDisbursement,
  postAdvanceManualReceiptVerification,
  postAdvanceRequest,
  postPastAdvance,
  postAdvanceSettlement,
  postAdvanceSettlementAcknowledgement,
  postEmployeePayment,
  postPastEmployeePayment,
  postPaymentAcknowledgement,
  postPaymentDecision,
  postPaymentDisbursement,
  postPaymentManualReceiptVerification,
} from "../controllers/employeeFinanceOperationsController.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/advance-requests", requireRole("owner", "manager", "cashier", "employee"), getAdvanceRequests);
router.post("/advance-requests", requireRole("owner", "manager", "cashier", "employee"), postAdvanceRequest);
router.post("/past-advances", requireRole("owner", "manager", "cashier"), postPastAdvance);
router.post("/advance-requests/:id/decision", requireRole("owner", "manager"), postAdvanceDecision);
router.post("/advance-requests/:id/disburse", requireRole("owner", "manager", "cashier"), postAdvanceDisbursement);
router.post("/advance-requests/:id/acknowledge", requireRole("employee", "manager", "cashier"), postAdvanceAcknowledgement);
router.get("/advance-requests/:id/paper-receipt", requireRole("owner", "manager", "cashier"), openAdvanceRequestPaperReceipt);
router.post("/advance-requests/:id/verify-paper-receipt", requireRole("owner", "manager"), postAdvanceManualReceiptVerification);
router.post("/advance-requests/:id/settlements", requireRole("owner", "manager"), postAdvanceSettlement);
router.post("/advance-requests/:id/settlements/:settlementId/acknowledge", requireRole("employee", "manager", "cashier"), postAdvanceSettlementAcknowledgement);

router.get("/payments", requireRole("owner", "manager", "cashier", "employee"), getEmployeePayments);
router.post("/payments", requireRole("owner", "manager", "cashier"), postEmployeePayment);
router.post("/past-payments", requireRole("owner", "manager", "cashier"), postPastEmployeePayment);
router.post("/payments/:id/decision", requireRole("owner", "manager"), postPaymentDecision);
router.post("/payments/:id/disburse", requireRole("owner", "manager", "cashier"), postPaymentDisbursement);
router.post("/payments/:id/acknowledge", requireRole("employee", "manager", "cashier"), postPaymentAcknowledgement);
router.get("/payments/:id/paper-receipt", requireRole("owner", "manager", "cashier"), openEmployeePaymentPaperReceipt);
router.post("/payments/:id/verify-paper-receipt", requireRole("owner", "manager"), postPaymentManualReceiptVerification);

router.get("/receipts", requireRole("owner", "manager", "cashier", "employee"), getFinanceReceipts);
router.get("/receipts/:id", requireRole("owner", "manager", "cashier", "employee"), getFinanceReceiptDetail);
router.get("/receipts/:id/pdf", requireRole("owner", "manager", "cashier", "employee"), openFinanceReceiptPdf);
router.get("/receipts/:id/signatures/:signatureId", requireRole("owner", "manager", "cashier", "employee"), openFinanceReceiptSignature);
router.get("/receipts/:id/manual-receipt", requireRole("owner", "manager", "cashier", "employee"), openFinanceManualReceipt);

export default router;
