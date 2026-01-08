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


const resolveSalonId = (req) => {
  return (
    req.user?.salon_id ||
    req.salon_id ||
    Number(process.env.DEFAULT_SALON_ID)
  );
};

// ---------------- LOGIN ----------------
export const login = (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    console.log("authed user in auth controller", user)
    if (err) return next(err);
    if (!user) return res.status(400).json({ message: info.message });

    req.logIn(user, (err) => {
      if (err) return next(err);
      const { password, ...userSafe } = user;
      res.json({ user: userSafe });
    });
  })(req, res, next);
};

// ---------------- LOGOUT ----------------
export const logoutUser = (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: "Logout failed" });
    res.status(200).json({ message: "Logged out successfully" });
  });
};

// ---------------- CHECK AUTH ----------------
export const checkAuth = (req, res) => {
  if (!req.isAuthenticated())
    return res.status(401).json({ message: "Not authenticated" });

  const { password, ...userSafe } = req.user;
  res.json({ user: userSafe });
};

// ---------------- ROLE PROTECTION ----------------
export const ensureRole = (role) => (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === role) return next();
  return res.status(401).json({ message: "Unauthorized" });
};

// ---------------- FORGOT PASSWORD ----------------
export const forgotPasswordController = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const salon_id = resolveSalonId(req);

  try {
    // 1️⃣ Find user by email + salon_id
    const user = await findUserByEmail(email, salon_id);
    if (!user)
      return res.status(404).json({ message: "No user with that email" });

    // 2️⃣ Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    // 3️⃣ Save reset token (WITH salon_id)
    await createPasswordReset(user.id, token, expiresAt, salon_id);

    // 4️⃣ Email transport
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <h2>Salon Management System</h2>
        <p>Hello ${user.first_name || ""},</p>
        <p>You requested a password reset.</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>This link expires in 1 hour.</p>
      `,
    });

    res.status(200).json({ message: "Password reset link sent" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------- RESET PASSWORD ----------------
export const resetPasswordController = async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ message: "Token and new password required" });

  try {
    // 1️⃣ Get reset entry (already includes salon_id)
    const resetEntry = await getPasswordResetByToken(token);
    if (!resetEntry)
      return res.status(400).json({ message: "Invalid or expired token" });

    const salon_id = resetEntry.salon_id;

    // 2️⃣ Hash & update password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await updateUserPasswordById(
      resetEntry.user_id,
      hashedPassword,
      salon_id
    );

    // 3️⃣ Delete token
    await deletePasswordResetById(resetEntry.id, salon_id);

    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export default {
  login,
  logoutUser,
  checkAuth,
  ensureRole,
  forgotPasswordController,
  resetPasswordController,
};
