import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import {
  saveUser,
  fetchAllUsers,
  fetchBookableStaff,
  fetchUserById,
  UpdateUserById,
  updateOwnCustomerProfile,
  DeleteUserById,
} from "../models/usersModel.js";
import { findUserByEmail } from "../models/usersModel.js";
import dotenv from "dotenv";
dotenv.config();
const ALLOWED_ROLES = new Set(["owner", "manager", "cashier", "employee", "customer"]);

const normalizedEmail = (email) => String(email || "").trim().toLowerCase();

const createCustomerAccount = async ({ body, file, salon_id }) => {
  const first_name = String(body.first_name || "").trim();
  const middle_name = String(body.middle_name || "").trim() || null;
  const last_name = String(body.last_name || "").trim();
  const email = normalizedEmail(body.email);
  const password = String(body.password || "");

  if (!salon_id) {
    const error = new Error("Customer registration is not configured for this salon");
    error.statusCode = 503;
    throw error;
  }
  if (!first_name || !last_name || !email || !password) {
    const error = new Error("First name, last name, email, and password are required");
    error.statusCode = 400;
    throw error;
  }

  const existingUser = await findUserByEmail(email, salon_id);
  if (existingUser) {
    const error = new Error("An account with this email already exists");
    error.statusCode = 409;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
  return saveUser({
    salon_id,
    first_name,
    middle_name,
    last_name,
    email,
    password: hashedPassword,
    contact: body.contact,
    role: "customer",
    status: "active",
    gender: body.gender,
    image_url: file ? `/uploads/images/${file.filename}` : null,
  });
};

/** Public self-registration. Role and account status are forced server-side. */
export const registerCustomer = async (req, res) => {
  try {
    const customer = await createCustomerAccount({
      body: req.body,
      file: req.file,
      salon_id: Number(process.env.DEFAULT_SALON_ID),
    });
    res.status(201).json({
      message: "Customer account created successfully",
      data: customer,
    });
  } catch (err) {
    console.error("Error registering customer:", err);
    res.status(err.statusCode || 500).json({
      error: err.statusCode ? err.message : "Failed to create customer account",
    });
  }
};

export const setupOwnerUser = async (req, res) => {
  try {
    const { salon_id, email, password } = req.body;

    if (!salon_id || !email || !password) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Step 1: check if user already exists
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(200).json({
        message: "User already exists, proceed to login",
        user: existingUser,
        isNew: false,
      });
    }

    // Step 2: create new owner with only essential info
    const newUser = await saveUser({
      first_name: null,
      middle_name: null,
      last_name: null,
      email,
      password,
      contact: null,
      salon_id,
      role: "owner",
    });

    return res.status(201).json({
      message: "Owner account created successfully",
      user: newUser,
      isNew: true,
    });

  } catch (err) {
    console.error("Error in setupOwnerUser:", err);
    return res.status(500).json({ message: "Server error" });
  }
};




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

export const getBookableStaff = async (req, res) => {
  try {
    const salon_id = req.user?.salon_id || process.env.DEFAULT_SALON_ID;
    const staff = await fetchBookableStaff(salon_id);
    res.status(200).json(staff);
  } catch (err) {
    console.error("Error fetching bookable staff:", err);
    res.status(500).json({ error: "Failed to fetch bookable staff" });
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

export const getMyProfile = async (req, res) => {
  const profile = await fetchUserById(req.user.id, req.user.salon_id);
  if (!profile) return res.status(404).json({ error: "Profile not found" });
  return res.json({ data: profile });
};

export const updateMyProfile = async (req, res) => {
  try {
    if (String(req.user.role || "").toLowerCase() !== "customer") {
      return res.status(403).json({ error: "Customer profile access only" });
    }

    const first_name = String(req.body.first_name || "").trim();
    const middle_name = String(req.body.middle_name || "").trim();
    const last_name = String(req.body.last_name || "").trim();
    const contact = String(req.body.contact || "").trim();
    const gender = String(req.body.gender || "").trim().toLowerCase();

    if (!first_name || !last_name) {
      return res.status(400).json({ error: "First name and last name are required" });
    }
    if (gender && !["male", "female", "other"].includes(gender)) {
      return res.status(400).json({ error: "Select a valid gender" });
    }

    const existing = await fetchUserById(req.user.id, req.user.salon_id);
    if (!existing) return res.status(404).json({ error: "Profile not found" });

    let image_url = null;
    if (req.file?.filename) {
      image_url = `/uploads/images/${req.file.filename}`;
      if (existing.image_url?.startsWith("/uploads/images/")) {
        const oldPath = path.join(process.cwd(), existing.image_url);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
    }

    const profile = await updateOwnCustomerProfile({
      id: req.user.id,
      salon_id: req.user.salon_id,
      first_name,
      middle_name,
      last_name,
      contact,
      gender,
      image_url,
    });

    return res.json({ message: "Profile updated successfully", data: profile });
  } catch (error) {
    console.error("Error updating customer profile:", error);
    return res.status(500).json({ error: "Profile could not be updated" });
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
      email: submittedEmail,
      password,
      birthdate,
      contact,
      next_of_kin,
      next_of_kin_contact,
      role,
      gender,
      specialty,
      status,
      bio,
    } = req.body;

    const email = normalizedEmail(submittedEmail);

    if (!password) {
      return res.status(400).json({ error: "Password is required" });
    }
    if (!ALLOWED_ROLES.has(role)) return res.status(400).json({ error: "Invalid role" });
    if (role === "owner") return res.status(403).json({ error: "Owner accounts can only be created through secure salon setup" });

    if (!salon_id) return res.status(503).json({ error: "Salon context is not configured" });
    if (!first_name?.trim() || !last_name?.trim() || !email) {
      return res.status(400).json({ error: "First name, last name, and email are required" });
    }
    const existingUser = await findUserByEmail(email, salon_id);
    if (existingUser) return res.status(409).json({ error: "An account with this email already exists" });

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
      gender,
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
      gender,
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
    if (!ALLOWED_ROLES.has(role)) return res.status(400).json({ error: "Invalid role" });
    if (role === "owner" && existingUser.role !== "owner") return res.status(403).json({ error: "Only secure salon setup can assign the owner role" });

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
      gender,
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
  registerCustomer,
  getMyProfile,
  updateMyProfile,
  updateUserById,
  deleteUserById,
};

