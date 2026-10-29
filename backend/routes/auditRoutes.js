import express from "express";
import { requireRole } from "../middleware/auth.js";
import { getAuditEvents } from "../controllers/auditController.js";

const router = express.Router();

// Audit history can contain sensitive operational context, so it is owner-only.
router.get("/", requireRole("owner"), getAuditEvents);

export default router;
