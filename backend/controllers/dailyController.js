import dotenv from "dotenv";
dotenv.config();

import dailyModel from "../models/dailyModel.js";

/**
 * Resolve salon_id safely:
 * 1. Logged-in user
 * 2. Request-scoped salon (future-proof)
 * 3. DEFAULT_SALON_ID from env
 */
const resolveSalonId = (req) => {
  return (
    req.user?.salon_id ||
    req.salon_id ||
    Number(process.env.DEFAULT_SALON_ID)
  );
};

export async function getDailyReport(req, res) {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Missing date" });

    const salon_id = resolveSalonId(req);
    if (!salon_id) {
      return res.status(400).json({ error: "Salon context missing" });
    }

    const [
      services,
      expenses,
      advances,
      clockings,
      tagFees,
      lateFees,
      employees
    ] = await Promise.all([
      dailyModel.getServicesByDay(date, salon_id),
      dailyModel.getExpensesByDay(date, salon_id),
      dailyModel.getAdvancesByDay(date, salon_id),
      dailyModel.getClockingsByDay(date, salon_id),
      dailyModel.getTagFeesByDay(date, salon_id),
      dailyModel.getLateFeesByDay(date, salon_id),
      dailyModel.fetchAllEmployees(salon_id)
    ]);

    console.log("✅ Daily Report Generated:", {
      date,
      salon_id,
      servicesCount: services?.length,
      expensesCount: expenses?.length,
      advancesCount: advances?.length,
      clockingsCount: clockings?.length,
      tagFeesCount: tagFees?.length,
      lateFeesCount: lateFees?.length
    });

    res.json({
      services,
      expenses,
      advances,
      clockings,
      tagFees,
      lateFees,
      employees
    });

  } catch (error) {
    console.error("❌ Error fetching daily report:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}







// import dailyModel from '../models/dailyModel.js';



// export async function getDailyReport(req, res) {
//   try {
//     const { date } = req.query;
//     if (!date) return res.status(400).json({ error: "Missing date" });


//     const [
//       services,
//       expenses,
//       advances,
//       clockings,
//       tagFees,
//       lateFees,
//       employees
//     ] = await Promise.all([
//       dailyModel.getServicesByDay(date),
//       dailyModel.getExpensesByDay(date),
//       dailyModel.getAdvancesByDay(date),
//       dailyModel.getClockingsByDay(date),
//       dailyModel.getTagFeesByDay(date),
//       dailyModel.getLateFeesByDay(date),
//       dailyModel.fetchAllEmployees()
//     ]);

    
//     console.log("✅ Daily Report Generated:", {
//       date,
//       servicesCount: services,
//       expensesCount: expenses,
//       advancesCount: advances,
//       clockingsCount: clockings,
//       tagFeesCount: tagFees,
//       lateFeesCount: lateFees
//     });


//     res.json({
//       services,
//       expenses,
//       advances,
//       clockings,
//       tagFees,
//       lateFees,
//       employees
//     });

//   } catch (error) {
//     console.error("❌ Error fetching daily report:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// }