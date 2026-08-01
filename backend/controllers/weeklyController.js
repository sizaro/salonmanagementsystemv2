import { getReportData } from "../models/reportModel.js";
import { BUSINESS_TIMEZONE, weeklyPeriod } from "../utils/reportPeriod.js";

export async function getWeeklyReport(req, res) {
  try {
    const period = weeklyPeriod(req.query.startDate, req.query.endDate);
    res.json(await getReportData({ salonId: Number(req.user.salon_id), ...period, timezone: BUSINESS_TIMEZONE }));
  } catch (error) { res.status(400).json({ error: error.message || "Unable to create weekly report" }); }
}
