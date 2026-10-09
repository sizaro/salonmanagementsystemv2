import express from "express";
import { requireRole } from "../middleware/auth.js";
import { getInsights, patchCampaign, postCampaign, postGoal } from "../controllers/ownerIntelligenceController.js";
const router = express.Router();
router.get("/", requireRole("owner"), getInsights);
router.post("/goals", requireRole("owner"), postGoal);
router.post("/campaigns", requireRole("owner"), postCampaign);
router.patch("/campaigns/:id", requireRole("owner"), patchCampaign);
export default router;
