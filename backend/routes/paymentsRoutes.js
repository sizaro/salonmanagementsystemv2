import express from "express";
import { requireRole } from "../middleware/auth.js";
import {
  createServicePaymentIntent,
  createAdvanceRepaymentPaymentIntent,
  createExternalDisbursement,
  exportExternalPayments,
  getPaymentIntentStatus,
  inquireBankTransfer,
  listBankAccounts,
  listExternalPayments,
  postMockBankCredit,
  resolveDevelopmentMockIntent,
  saveBankAccount,
  verifyManualBankPayout,
} from "../controllers/paymentsController.js";

const router = express.Router();

router.post(
  "/service-intents",
  requireRole("owner", "manager", "cashier"),
  createServicePaymentIntent,
);
router.post(
  "/advance-repayment-intents",
  requireRole("owner", "manager"),
  createAdvanceRepaymentPaymentIntent,
);
router.post("/disbursements", requireRole("owner", "manager", "cashier"), createExternalDisbursement);
router.get("/intents/:reference", requireRole("owner", "manager", "cashier"), getPaymentIntentStatus);
router.post("/bank/intents/:reference/inquire", requireRole("owner", "manager", "cashier"), inquireBankTransfer);
router.post("/bank/disbursements/:reference/verify-manual", requireRole("owner", "manager"), verifyManualBankPayout);
router.post("/mock/intents/:reference/:outcome", requireRole("owner", "manager", "cashier"), resolveDevelopmentMockIntent);
router.post("/mock/bank-credits", requireRole("owner"), postMockBankCredit);
router.get("/bank-accounts", requireRole("owner", "manager", "cashier"), listBankAccounts);
router.post("/bank-accounts", requireRole("owner"), saveBankAccount);
router.get("/ledger", requireRole("owner", "manager", "cashier"), listExternalPayments);
router.get("/ledger/export/:format", requireRole("owner", "manager"), exportExternalPayments);

export default router;
