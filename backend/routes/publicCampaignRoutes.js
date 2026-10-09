import express from "express";
import { getPublicCampaigns } from "../controllers/ownerIntelligenceController.js";
const router = express.Router();
router.get("/campaigns", getPublicCampaigns);
export default router;
