import express from "express";
import { setupSalonStep1 } from "../controllers/salonController.js";

const router = express.Router();


router.post("/setup-step1", setupSalonStep1);

export default router;
