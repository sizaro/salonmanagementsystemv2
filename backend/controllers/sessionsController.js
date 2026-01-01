import dotenv from "dotenv";
dotenv.config();

import { saveSalonSession, updateSalonSession, fetchTodaySalonSession } from '../models/sessionsModel.js';

// Resolve salon_id from request or fallback to env
const resolveSalonId = (req) => {
  return (
    req.user?.salon_id ||
    req.salon_id ||
    Number(process.env.DEFAULT_SALON_ID)
  );
};

// OPEN SALON SESSION
export const openSalonSession = async (req, res) => {
  try {
    const salon_id = resolveSalonId(req);
    if (!salon_id) return res.status(400).json({ error: "Salon context missing" });

    const { status } = req.body;
    console.log("🔹 Opening salon session:", status, "for salon:", salon_id);

    const session = await saveSalonSession(salon_id, status);

    res.status(201).json({
      message: "Salon session opened successfully",
      data: session
    });
  } catch (error) {
    console.error("Error opening salon session:", error);
    res.status(500).json({ message: "Failed to open salon session" });
  }
};

// CLOSE SALON SESSION
export const closeSalonSession = async (req, res) => {
  try {
    const salon_id = resolveSalonId(req);
    if (!salon_id) return res.status(400).json({ error: "Salon context missing" });

    const { status } = req.body;
    console.log("🔹 Closing salon session:", status, "for salon:", salon_id);

    const session = await updateSalonSession(salon_id, status);

    res.status(200).json({
      message: "Salon session closed successfully",
      data: session
    });
  } catch (error) {
    console.error("Error closing salon session:", error);
    res.status(500).json({ message: "Failed to close salon session" });
  }
};

// GET TODAY'S SALON SESSION
export const getSalonSession = async (req, res) => {
  try {
    const salon_id = resolveSalonId(req);
    if (!salon_id) return res.status(400).json({ error: "Salon context missing" });

    const session = await fetchTodaySalonSession(salon_id);
    if (!session) {
      console.log("🔹 No open session today for salon:", salon_id);
      return res.json({ status: "closed" });
    }

    console.log("🔹 Current salon session:", session);
    res.json(session);
  } catch (error) {
    console.error("Error fetching salon session:", error);
    res.status(500).json({ message: "Failed to fetch salon session" });
  }
};
