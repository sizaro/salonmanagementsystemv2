import { getReportData } from "../models/reportModel.js";
import { BUSINESS_TIMEZONE, monthlyPeriod } from "../utils/reportPeriod.js";

export async function getMonthlyReport(req, res) {
  try {
    const period = monthlyPeriod(req.query.year, req.query.month);
    res.json(await getReportData({ salonId: Number(req.user.salon_id), ...period, timezone: BUSINESS_TIMEZONE }));
  } catch (error) { res.status(400).json({ error: error.message || "Unable to create monthly report" }); }
}
