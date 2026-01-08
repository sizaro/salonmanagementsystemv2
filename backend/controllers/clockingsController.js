import dotenv from "dotenv";
dotenv.config();

import {
  saveClocking,
  updateClockingModel,
  fetchAllClockings
} from "../models/clockingsModel.js";


const resolveSalonId = (req) => {
  return (
    req.user?.salon_id ||
    req.salon_id ||
    Number(process.env.DEFAULT_SALON_ID)
  );
};

// ---------------- CREATE CLOCKING ----------------
export const createClocking = async (req, res) => {
  try {
    const { employee_id } = req.body;
    const salon_id = resolveSalonId(req);

    if (!salon_id) {
      return res.status(400).json({ message: "Missing salon context" });
    }

    console.log("data coming from the frontend", {
      employee_id,
      salon_id
    });

    await saveClocking({
      employee_id,
      salon_id
    });

    res.status(201).json({
      message: "Clocking created successfully",
    });
  } catch (error) {
    console.error("Error creating clocking:", error);
    res.status(500).json({ message: "Failed to create clocking" });
  }
};

// ---------------- UPDATE CLOCKING ----------------
export const updateClocking = async (req, res) => {
  try {
    const { employee_id } = req.body;
    const salon_id = resolveSalonId(req);

    if (!salon_id) {
      return res.status(400).json({ message: "Missing salon context" });
    }

    console.log("data arriving for update", {
      employee_id,
      salon_id
    });

    await updateClockingModel({
      employee_id,
      salon_id
    });

    res.status(200).json({
      message: "Clocking updated successfully",
    });
  } catch (error) {
    console.error("Error updating clocking:", error);
    res.status(500).json({ message: "Failed to update clocking" });
  }
};

// ---------------- GET ALL CLOCKINGS ----------------
export const getAllClocking = async (req, res) => {
  try {
    const salon_id = resolveSalonId(req);

    if (!salon_id) {
      return res.status(400).json({ message: "Missing salon context" });
    }

    const clockings = await fetchAllClockings(salon_id);

    console.log("this is in the controller for clockings", clockings);

    res.status(200).json(clockings);
  } catch (err) {
    console.error("Error fetching clockings:", err);
    res.status(500).json({ error: "Failed to fetch clockings" });
  }
};




// import { saveClocking, updateClockingModel, fetchAllClockings} from '../models/clockingsModel.js';

// export const createClocking = async (req, res) => {
//   try {
//     const { employee_id } = req.body;

//     console.log("data coming from the frontend", employee_id)

//     // Call the model to save in DB
//     await saveClocking(employee_id);

//     res.status(201).json({
//       message: "Clocking created successfully",
//     });
//   } catch (error) {
//     console.error("Error creating clocking:", error);
//     res.status(500).json({ message: "Failed to create clocking" });
//   }
// };

// export const updateClocking = async (req, res) => {
//   try {
//     const { employee_id } = req.body

//     console.log("data arriving for update", employee_id)
//     await updateClockingModel(employee_id);

//     res.status(200).json({
//       message: "Clocking updated successfully",
//     });
//   } catch (error) {
//     console.error("Error updating clocking:", error);
//     res.status(500).json({ message: "Failed to update clocking" });
//   }
// };

// export const getAllClocking = async (req, res) => {
//   try {
//     const clockings = await fetchAllClockings();
//     console.log("this is in the controller for clockings", clockings)
//     res.status(200).json(clockings);
//   } catch (err) {
//     console.error('Error fetching clockings:', err);
//     res.status(500).json({ error: 'Failed to fetch clockings' });
//   }
// };
