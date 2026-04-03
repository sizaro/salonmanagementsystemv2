import * as salonModel from "../models/salonModel.js";

export const setupSalonStep1 = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({ message: "Email and phone are required" });
    }

    // Step 1: check if salon exists
    const existingSalon = await salonModel.getSalonByEmailOrPhone(email, phone);

    if (existingSalon) {
      // Salon exists → skip setup
      return res.status(200).json({
        message: "Salon already exists, proceed to landing page",
        salon: existingSalon,
        isNew: false,
      });
    }

    // Step 2: create new salon
    const newSalon = await salonModel.createSalon(email, phone);

    return res.status(201).json({
      message: "Salon created successfully",
      salon: newSalon,
      isNew: true,
    });

  } catch (err) {
    console.error("Error in setupSalonStep1:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
