import express from "express";
import { receiveBankNotification } from "../controllers/paymentsController.js";

const router = express.Router();

// This route authenticates the bank's raw payload with BANK_WEBHOOK_SECRET.
// It intentionally does not use a Salehish browser session or trusted-origin check.
router.post("/:accountId", receiveBankNotification);

export default router;
