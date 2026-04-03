import express from "express";
import { setupSalonProfile, updateProfile } from "../controllers/salonProfileController.js";

const router = express.Router();

// POST → setup profile after salon creation
router.post("/setup", setupSalonProfile);

// PUT → update profile later
router.put("/update", updateProfile);

export default router;
