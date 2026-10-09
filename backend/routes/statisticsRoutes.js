import express from "express";
import { requireRole } from "../middleware/auth.js";
import { getStatistics, getStatisticsOptions } from "../controllers/statisticsController.js";

const router = express.Router();

router.get("/options", requireRole("owner", "manager"), getStatisticsOptions);
router.get("/report", requireRole("owner", "manager"), getStatistics);

export default router;
