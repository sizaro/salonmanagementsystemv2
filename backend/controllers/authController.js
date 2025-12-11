import passport from "passport";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import dotenv from "dotenv";
dotenv.config();


import nodemailer from "nodemailer";
import { findUserByEmail } from "../models/usersModel.js";
import {
  createPasswordReset,
  getPasswordResetByToken,
  deletePasswordResetById,
  updateUserPasswordById
} from "../models/authModels.js";

// LOGIN
export const login = (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(400).json({ message: info.message });

    req.logIn(user, (err) => {
      if (err) return next(err);
      const { password, ...userSafe } = user;    
      console.log("user in login auth cont:", user.data)    
      console.log("usersafe in login auth cont:", userSafe)                                                                                                                                                                                                                                                                                                                                                                              
      res.json({ user: userSafe });
    });
  })(req, res, next);
};

// LOGOUT
export const logoutUser = (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.status(200).json({ message: "Logged out successfully" });
  });
};

// CHECK AUTH
export const checkAuth = (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ message: "Not authenticated" });

  const { password, ...userSafe } = req.user;
  res.json({ user: userSafe });
};

// Role-protect backend routes
export const ensureRole = (role) => (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === role) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

// -------- FORGOT PASSWORD --------
export const forgotPasswordController = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    // 1️⃣ Find user by email using your usersModel function
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ message: "No user with that email" });

    // 2️⃣ Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour

    // 3️⃣ Save reset token using authModels function
    await createPasswordReset(user.id, token, expiresAt);

    // 4️⃣ Send email
    const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // Brevo uses TLS on 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <p>Hello ${user.first_name || ""},</p>
        <p>You requested a password reset. Click below to reset your password:</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link expires in 1 hour.</p>
        <p>If you did not request this, ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Password reset link sent to your email" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// -------- RESET PASSWORD --------
export const resetPasswordController = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ message: "Token and new password required" });

  try {
    // 1️⃣ Find token in DB and check expiry
    const resetEntry = await getPasswordResetByToken(token);
    if (!resetEntry) return res.status(400).json({ message: "Invalid or expired token" });

    // 2️⃣ Update user's password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await updateUserPasswordById(resetEntry.user_id, hashedPassword);

    // 3️⃣ Delete the reset token after use
    await deletePasswordResetById(resetEntry.id);

    res.status(200).json({ message: "Password has been reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};