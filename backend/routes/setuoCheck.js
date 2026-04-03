import express from "express";
import { checkSetupStatus } from "../controllers/setupController.js";

const router = express.Router();

router.get("/check", checkSetupStatus);

export default router;
