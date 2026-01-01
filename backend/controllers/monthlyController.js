import monthlyModel from "../models/monthlyModel.js";

// Controller to handle requests for monthly reports
export const getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: "Year and month are required" });
    }

    // Get salon_id from logged-in user
    const salon_id = req.user.salon_id;
    if (!salon_id) {
      return res.status(400).json({ error: "Salon ID missing" });
    }

    console.log("Received in controller → year:", year, "month:", month, "salon_id:", salon_id);

    const [services, expenses, advances, tagFees, lateFees] = await Promise.all([
      monthlyModel.getServicesByMonth(year, month, salon_id),
      monthlyModel.getExpensesByMonth(year, month, salon_id),
      monthlyModel.getAdvancesByMonth(year, month, salon_id),
      monthlyModel.getTagFeesByMonth(year, month, salon_id),
      monthlyModel.getLateFeesByMonth(year, month, salon_id)
    ]);

    res.json({
      services,
      expenses,
      advances,
      tagFees,
      lateFees
    });

  } catch (err) {
    console.error("Error fetching monthly report:", err);
    res.status(500).json({ error: "Server error" });
  }
};






// import monthlyModel from "../models/monthlyModel.js";

// // Controller to handle requests for monthly reports


// export const getMonthlyReport = async (req, res) => {
//   try {
//     const { year, month } = req.query;

//     if (!year || !month) {
//       return res.status(400).json({ error: "Year and month are required" });
//     }

//     console.log("Received in controller → year:", year, "month:", month);

//     const [services, expenses, advances, tagFees, lateFees] = await Promise.all([
//       monthlyModel.getServicesByMonth(year, month),
//       monthlyModel.getExpensesByMonth(year, month),
//       monthlyModel.getAdvancesByMonth(year, month),
//       monthlyModel.getTagFeesByMonth(year, month),
//       monthlyModel.getLateFeesByMonth(year, month)
//     ]);

//     res.json({
//       services,
//       expenses,
//       advances,
//       tagFees,
//       lateFees
//     });

//   } catch (err) {
//     console.error("Error fetching monthly report:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// };

