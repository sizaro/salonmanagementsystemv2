import { fetchUserById } from "../models/usersModel.js";
import { getSalonProfileBySalonId } from "../models/salonProfileModel.js";

export const checkSetupStatus = async (req, res) => {
  try {
    const userId = req.user?.id; // if logged in
    if (!userId) return res.status(200).json({ setupComplete: false });

    const user = await fetchUserById(userId, req.user.salon_id);
    if (!user) return res.status(200).json({ setupComplete: false });

    const profile = await getSalonProfileBySalonId(user.salon_id);

    const setupComplete = user && profile;
    res.status(200).json({ setupComplete });
  } catch (err) {
    console.error("Error checking setup status:", err);
    res.status(500).json({ setupComplete: false });
  }
};
