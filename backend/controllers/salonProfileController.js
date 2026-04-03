import { createSalonProfile, getSalonProfileBySalonId, updateSalonProfile } from "../models/salonProfileModel.js";

/**
 * Setup salon profile after salon is created
 */
export const setupSalonProfile = async (req, res) => {
  try {
    const { salon_id, name, tagline, logo, slug } = req.body;

    if (!salon_id || !name || !slug) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const existingProfile = await getSalonProfileBySalonId(salon_id);
    if (existingProfile) {
      return res.status(200).json({ message: "Profile already exists", profile: existingProfile });
    }

    const profile = await createSalonProfile({ salon_id, name, tagline, logo, slug });

    res.status(201).json({ message: "Salon profile created", profile });
  } catch (err) {
    console.error("Error setting up salon profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * Update salon profile
 */
export const updateProfile = async (req, res) => {
  try {
    const { salon_id, name, tagline, logo, slug } = req.body;

    if (!salon_id || !name || !slug) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const updatedProfile = await updateSalonProfile({ salon_id, name, tagline, logo, slug });

    res.status(200).json({ message: "Salon profile updated", profile: updatedProfile });
  } catch (err) {
    console.error("Error updating salon profile:", err);
    res.status(500).json({ message: "Server error" });
  }
};
