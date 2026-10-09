import * as salonModel from "../models/salonModel.js";

export const setupSalonStep1 = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email || !phone) {
      return res.status(400).json({ message: "Email and phone are required" });
    }

    // Step 1: check if salon exists
    const existingSalon = await salonModel.getSalonByEmailOrPhone(email, phone);

    if (req.salon_id && existingSalon && Number(existingSalon.id) !== Number(req.salon_id)) {
      return res.status(403).json({ message: "You are not allowed to access another salon" });
    }

    if (existingSalon) {
      // Salon exists → skip setup
      return res.status(200).json({
        message: "Salon already exists, proceed to landing page",
        salon: existingSalon,
        isNew: false,
      });
    }

    // Step 2: create new salon
    // Authenticated production callers may only work with their own salon.
    if (req.salon_id) {
      return res.status(409).json({ message: "Salon creation is disabled after setup" });
    }

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
