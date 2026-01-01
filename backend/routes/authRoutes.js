// routes/authRoutes.js
import express from "express";
import passport from "passport";
import {forgotPasswordController, resetPasswordController  } from "../controllers/authController.js"


const router = express.Router();

router.post("/login", (req, res, next) => {
  console.log("🔹 /login route hit, body BEFORE passport:", req.body);
  next(); // pass to passport
}, passport.authenticate("local"), (req, res) => {
  console.log("🔹 /login successful, req.user:", req.user);
  console.log("🔹 req.session after login:", req.session);
  const { id, first_name, last_name, email, role } = req.user;
  res.json({ user: { id, first_name, last_name, email, role } });
});



// Check if user is authenticated

router.get("/check", (req, res) => {
  console.log("🔹 /check route hit, req.session:", req.session);
  console.log("🔹 req.isAuthenticated():", req.isAuthenticated());
  console.log("🔹 req.user:", req.user);

  if (req.isAuthenticated()) {
    const { id, first_name, last_name, email, role } = req.user;
    res.json({ user: { id, first_name, last_name, email, role } });
  } else {
    res.status(401).json({ message: "Not authenticated" });
  }
});


// Logout
router.post("/logout", (req, res) => {
  req.logout(err => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.json({ message: "Logged out successfully" });
  });
});

// forgot password

router.post("/forgot-password", forgotPasswordController);
router.post("/reset-password", resetPasswordController);

export default router;
