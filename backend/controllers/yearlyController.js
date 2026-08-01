import { getReportData } from "../models/reportModel.js";
import { BUSINESS_TIMEZONE, yearlyPeriod } from "../utils/reportPeriod.js";

export async function getYearlyReport(req, res) {
  try {
    const period = yearlyPeriod(req.query.year);
    res.json(await getReportData({ salonId: Number(req.user.salon_id), ...period, timezone: BUSINESS_TIMEZONE }));
  } catch (error) { res.status(400).json({ error: error.message || "Unable to create yearly report" }); }
}
