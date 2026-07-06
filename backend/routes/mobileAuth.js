import express from "express";
import { mobileLogin } from "../controllers/mobileAuthController.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { findUserByEmail } from "../models/usersModel.js";

const router = express.Router();

// mobile login route
router.post("/auth/login", mobileLogin);

router.get("/auth/test", async (req, res) => {
  const email = "ntegesaleh@gmail.com";
  const password = "salehish25";

  try {
    const user = await findUserByEmail(email, 1);
    if (!user) return res.json({ message: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json({ message: "Wrong password" });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      "mysecret123",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        role: user.role,
      },
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

export default router;