import yearlyModel from "../models/yearlyModel.js";

export const getYearlyReport = async (req, res) => {
  try {
    const { year } = req.query;
    const salon_id = req.user.salon_id; // get salon_id from logged-in user

    if (!year) {
      return res.status(400).json({ error: "Year is required" });
    }

    console.log("Received in the controller year:", year, "Salon ID:", salon_id);

    const [
      services,
      expenses,
      advances,
      tagFees,
      lateFees
    ] = await Promise.all([
      yearlyModel.getServicesByYear(year, salon_id),
      yearlyModel.getExpensesByYear(year, salon_id),
      yearlyModel.getAdvancesByYear(year, salon_id),
      yearlyModel.getTagFeesByYear(year, salon_id),
      yearlyModel.getLateFeesByYear(year, salon_id)
    ]);

    console.log("Yearly services:", services.length);
    console.log("Yearly expenses:", expenses.length);
    console.log("Yearly advances:", advances.length);
    console.log("Yearly tag fees:", tagFees.length);
    console.log("Yearly late fees:", lateFees.length);

    res.json({
      services,
      expenses,
      advances,
      tagFees,
      lateFees
    });

  } catch (err) {
    console.error("Error fetching yearly report:", err);
    res.status(500).json({ error: "Server error" });
  }
};




// import yearlyModel from "../models/yearlyModel.js";


// export const getYearlyReport = async (req, res) => {
//   try {
//     const { year } = req.query;

//     if (!year) {
//       return res.status(400).json({ error: "Year is required" });
//     }

//     console.log("Received in the controller year:", year);

//     const [
//       services,
//       expenses,
//       advances,
//       tagFees,
//       lateFees
//     ] = await Promise.all([
//       yearlyModel.getServicesByYear(year),
//       yearlyModel.getExpensesByYear(year),
//       yearlyModel.getAdvancesByYear(year),
//       yearlyModel.getTagFeesByYear(year),
//       yearlyModel.getLateFeesByYear(year)
//     ]);

//     console.log("Yearly services:", services.length);
//     console.log("Yearly expenses:", expenses.length);
//     console.log("Yearly advances:", advances.length);
//     console.log("Yearly tag fees:", tagFees.length);
//     console.log("Yearly late fees:", lateFees.length);

//     res.json({
//       services,
//       expenses,
//       advances,
//       tagFees,
//       lateFees
//     });

//   } catch (err) {
//     console.error("Error fetching yearly report:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// };
