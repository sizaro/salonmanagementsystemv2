import dotenv from "dotenv";
dotenv.config();

import monthlyModel from "../models/monthlyModel.js";


const resolveSalonId = (req) => {
  return (
    req.user?.salon_id ||
    req.salon_id ||
    Number(process.env.DEFAULT_SALON_ID)
  );
};

// Controller to handle requests for monthly reports
export const getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: "Year and month are required" });
    }

    const salon_id = resolveSalonId(req);
    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    console.log("📊 Monthly report request:", {
      year,
      month,
      salon_id
    });

    const [
      services,
      expenses,
      advances,
      tagFees,
      lateFees
    ] = await Promise.all([
      monthlyModel.getServicesByMonth(year, month, salon_id),
      monthlyModel.getExpensesByMonth(year, month, salon_id),
      monthlyModel.getAdvancesByMonth(year, month, salon_id),
      monthlyModel.getTagFeesByMonth(year, month, salon_id),
      monthlyModel.getLateFeesByMonth(year, month, salon_id)
    ]);

    res.status(200).json({
      services,
      expenses,
      advances,
      tagFees,
      lateFees
    });

  } catch (err) {
    console.error("❌ Error fetching monthly report:", err);
    res.status(500).json({ error: "Server error" });
  }
};

export default {
  getMonthlyReport
};

