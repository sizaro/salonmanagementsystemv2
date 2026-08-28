// routes/authRoutes.js
import express from "express";
import {
  login,
  logoutUser,
  checkAuth,
  forgotPasswordController,
  resetPasswordController,
  changePasswordController,
} from "../controllers/authController.js";
import { requireAuth, requireSalonContext } from "../middleware/auth.js";


const router = express.Router();

router.post("/login", login);



// Check if user is authenticated

router.get("/check", checkAuth);


// Logout
router.post("/logout", logoutUser);
router.post("/change-password", requireAuth, requireSalonContext, changePasswordController);

// forgot password

router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);

export default router;
