import { saveSalonSession, updateSalonSession, fetchTodaySalonSession } from '../models/sessionsModel.js';

// Helper to get salon_id safely
const getSalonId = (req, res) => {
  if (!req.user || !req.user.salon_id) {
    res.status(401).json({ error: "User not authenticated" });
    return null;
  }
  return req.user.salon_id;
};

// OPEN SALON SESSION
export const openSalonSession = async (req, res) => {
  try {
    const salon_id = getSalonId(req, res);
    if (!salon_id) return;

    const { status } = req.body;
    console.log("Opening salon session:", status, "for salon:", salon_id);

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
    const salon_id = getSalonId(req, res);
    if (!salon_id) return;

    const { status } = req.body;
    console.log("Closing salon session:", status, "for salon:", salon_id);

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
    const salon_id = getSalonId(req, res);
    if (!salon_id) return;

    const session = await fetchTodaySalonSession(salon_id);
    if (!session) {
      return res.json({ status: "closed" });
    }

    console.log("Current salon session:", session);
    res.json(session);
  } catch (error) {
    console.error("Error fetching salon session:", error);
    res.status(500).json({ message: "Failed to fetch salon session" });
  }
};





// import { saveSalonSession, updateSalonSession, fetchTodaySalonSession } from '../models/sessionsModel.js';

// export const openSalonSession = async (req, res) => {
//   try {
//     const {closeTime, status } = req.body;

//     console.log("Opening salon session:",closeTime, status);

//     await saveSalonSession(status);

//     res.status(201).json({
//       message: "Salon session opened successfully",
//     });
//   } catch (error) {
//     console.error("Error opening salon session:", error);
//     res.status(500).json({ message: "Failed to open salon session" });
//   }
// };


// export const closeSalonSession = async (req, res) => {
//   try {
//     const { status } = req.body;

//     console.log("Closing salon session:", status);

//     await updateSalonSession(status);

//     res.status(200).json({
//       message: "Salon session closed successfully",
//     });
//   } catch (error) {
//     console.error("Error closing salon session:", error);
//     res.status(500).json({ message: "Failed to close salon session" });
//   }
// };


// export const getSalonSession = async (req, res) => {
//   try {
//     const session = await fetchTodaySalonSession(); // call model
//     if (!session) {
//       return res.json({ status: "closed" }); // default if no open session today
//     }

//     console.log("this is the salon status in the controller", session)
//     res.json(session)
//   } catch (error) {
//     console.error("Error fetching salon status:", error);
//     res.status(500).json({ message: "Failed to fetch salon status" });
//   }
// };