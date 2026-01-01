import WeeklyModel from "../models/weeklyModel.js";

// Helper to get week range in Uganda time
const getWeekRange = (dateInput) => {
  console.log("Input date:", dateInput);

  const date = new Date(dateInput);
  console.log("Original date object:", date);

  const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  console.log("Day of week (0=Sun):", day);

  // Calculate Monday (adjust if Sunday)
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  console.log("Monday start local:", monday);

  // Uganda offset: convert local to UTC for DB
  const mondayUTC = new Date(monday.getTime() - monday.getTimezoneOffset() * 60000);
  console.log("Monday UTC for DB:", mondayUTC);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  console.log("Sunday end local:", sunday);

  const sundayUTC = new Date(sunday.getTime() - sunday.getTimezoneOffset() * 60000);
  console.log("Sunday UTC for DB:", sundayUTC);

  return { monday, sunday, mondayUTC, sundayUTC };
};

// Controller to get weekly report
export const getWeeklyReport = async (req, res) => {
  try {
    const { startDate } = req.query;
    const salon_id = req.user.salon_id; // <-- added salon_id

    if (!startDate)
      return res.status(400).json({ error: "Missing startDate query param" });

    const { mondayUTC, sundayUTC } = getWeekRange(startDate);
    console.log("Querying services from", mondayUTC, "to", sundayUTC, "for salon:", salon_id);

    const [services, expenses, advances, tagFees, lateFees] = await Promise.all([
      WeeklyModel.getServicesByDateRange(mondayUTC, sundayUTC, salon_id),
      WeeklyModel.getExpensesByDateRange(mondayUTC, sundayUTC, salon_id),
      WeeklyModel.getAdvancesByDateRange(mondayUTC, sundayUTC, salon_id),
      WeeklyModel.getTagFeesByDateRange(mondayUTC, sundayUTC, salon_id),
      WeeklyModel.getLateFeesByDateRange(mondayUTC, sundayUTC, salon_id)
    ]);

    console.log("Weekly services fetched:", services);

    res.json({
      services,
      expenses: expenses.rows,
      advances: advances.rows,
      tagFees: tagFees.rows,
      lateFees: lateFees.rows
    });

  } catch (err) {
    console.error("Error fetching weekly report:", err);
    res.status(500).json({ error: "Server error" });
  }
};



// import WeeklyModel from "../models/weeklyModel.js";

// // Helper to get week range in Uganda time
// const getWeekRange = (dateInput) => {
//   console.log("Input date:", dateInput);

//   const date = new Date(dateInput);
//   console.log("Original date object:", date);

//   const day = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
//   console.log("Day of week (0=Sun):", day);

//   // Calculate Monday (adjust if Sunday)
//   const diff = day === 0 ? -6 : 1 - day;
//   const monday = new Date(date);
//   monday.setDate(date.getDate() + diff);
//   monday.setHours(0, 0, 0, 0);
//   console.log("Monday start local:", monday);

//   // Uganda offset: convert local to UTC for DB
//   const mondayUTC = new Date(monday.getTime() - monday.getTimezoneOffset() * 60000);
//   console.log("Monday UTC for DB:", mondayUTC);

//   const sunday = new Date(monday);
//   sunday.setDate(monday.getDate() + 6);
//   sunday.setHours(23, 59, 59, 999);
//   console.log("Sunday end local:", sunday);

//   const sundayUTC = new Date(sunday.getTime() - sunday.getTimezoneOffset() * 60000);
//   console.log("Sunday UTC for DB:", sundayUTC);

//   return { monday, sunday, mondayUTC, sundayUTC };
// };

// // Controller to get weekly report
// export const getWeeklyReport = async (req, res) => {
//   try {
//     const { startDate } = req.query;
//     if (!startDate) return res.status(400).json({ error: "Missing startDate query param" });

//     const { mondayUTC, sundayUTC } = getWeekRange(startDate);
//     console.log("Querying services from", mondayUTC, "to", sundayUTC);

//     const [services, expenses, advances, tagFees, lateFees] = await Promise.all([
//       WeeklyModel.getServicesByDateRange(mondayUTC, sundayUTC),
//       WeeklyModel.getExpensesByDateRange(mondayUTC, sundayUTC),
//       WeeklyModel.getAdvancesByDateRange(mondayUTC, sundayUTC),
//       WeeklyModel.getTagFeesByDateRange(mondayUTC, sundayUTC),
//       WeeklyModel.getLateFeesByDateRange(mondayUTC, sundayUTC)
//     ]);

//     console.log("Weekly services fetched:", services);

//     res.json({
//       services,
//       expenses: expenses.rows,
//       advances: advances.rows,
//       tagFees: tagFees.rows,
//       lateFees: lateFees.rows
//     });

//   } catch (err) {
//     console.error("Error fetching weekly report:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// };
