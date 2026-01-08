import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import {
  saveUser,
  fetchAllUsers,
  fetchUserById,
  UpdateUserById,
  DeleteUserById,
} from "../models/usersModel.js";
import dotenv from "dotenv";
dotenv.config();

/**
 * Get all users for the current salon
 */
export const getAllUsers = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const users = await fetchAllUsers(salon_id);
    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

/**
 * Get single user by ID
 */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const user = await fetchUserById(id, salon_id);
    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching user by ID:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

/**
 * Create new user (with image upload)
 */
export const createUser = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const {
      first_name,
      middle_name,
      last_name,
      email,
      password,
      birthdate,
      contact,
      next_of_kin,
      next_of_kin_contact,
      role,
      specialty,
      status,
      bio,
    } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));

    const image_url = req.file
      ? `/uploads/images/${req.file.filename}`
      : null;

    const newUser = await saveUser({
      salon_id,
      first_name,
      middle_name,
      last_name,
      email,
      password: hashedPassword,
      birthdate,
      contact,
      next_of_kin,
      next_of_kin_contact,
      role,
      specialty,
      status,
      bio,
      image_url,
    });

    res.status(201).json({
      message: "User created successfully",
      data: newUser,
    });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
};

/**
 * Update user by ID
 */
export const updateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const {
      first_name,
      middle_name,
      last_name,
      email,
      password,
      birthdate,
      contact,
      next_of_kin,
      next_of_kin_contact,
      role,
      specialty,
      status,
      bio,
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    const existingUser = await fetchUserById(id, salon_id);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedData = {
      id,
      salon_id,
      first_name,
      middle_name,
      last_name,
      email,
      birthdate,
      contact,
      next_of_kin,
      next_of_kin_contact,
      role,
      specialty,
      status,
      bio,
    };

    // ✅ Hash password only if needed
    if (password) {
      const isHashed =
        typeof password === "string" &&
        password.startsWith("$2") &&
        password.length === 60;

      updatedData.password = isHashed
        ? password
        : await bcrypt.hash(password, await bcrypt.genSalt(10));
    }

    // ✅ Handle image upload and delete old image
    if (req.file && req.file.filename) {
      if (existingUser.image_url) {
        const oldPath = path.join(process.cwd(), existingUser.image_url);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updatedData.image_url = `/uploads/images/${req.file.filename}`;
    }

    const updatedUser = await UpdateUserById(updatedData);

    res.status(200).json({
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
};

/**
 * Delete user
 */
export const deleteUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;

    const existingUser = await fetchUserById(id, salon_id);
    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete image from disk if exists
    if (existingUser.image_url) {
      const imagePath = path.join(process.cwd(), existingUser.image_url);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }

    await DeleteUserById(id, salon_id);

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUserById,
  deleteUserById,
};

