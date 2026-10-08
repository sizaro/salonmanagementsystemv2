import {
  createEmployeeFinancePeriod,
  getEmployeeFinanceOverview,
  getSalonFinanceSummary,
  listEmployeeFinancePeriods,
} from "../models/employeeFinanceModel.js";

const sendError = (res, error) => {
  console.error("Employee finance error:", error);
  return res.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : "Unable to process employee finance data",
  });
};

export const getMyEmployeeFinanceOverview = async (req, res) => {
  try {
    const overview = await getEmployeeFinanceOverview({
      salonId: req.salon_id,
      employeeId: req.user.id,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
    });
    res.json({ overview });
  } catch (error) {
    sendError(res, error);
  }
};

export const getSalonFinanceSummaryController = async (req, res) => {
  try {
    const summary = await getSalonFinanceSummary({ salonId: req.salon_id });
    res.json({ summary });
  } catch (error) {
    sendError(res, error);
  }
};

export const getEmployeeFinanceOverviewById = async (req, res) => {
  const employeeId = Number(req.params.employeeId);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(400).json({ error: "A valid employee id is required" });
  }

  try {
    const overview = await getEmployeeFinanceOverview({
      salonId: req.salon_id,
      employeeId,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
    });
    res.json({ overview });
  } catch (error) {
    sendError(res, error);
  }
};

export const getEmployeeFinancePeriods = async (req, res) => {
  try {
    const periods = await listEmployeeFinancePeriods({ salonId: req.salon_id });
    res.json({ periods });
  } catch (error) {
    sendError(res, error);
  }
};

export const postEmployeeFinancePeriod = async (req, res) => {
  try {
    const period = await createEmployeeFinancePeriod({
      salonId: req.salon_id,
      createdBy: req.user.id,
      name: req.body?.name,
      periodType: req.body?.period_type,
      startDate: req.body?.start_date,
      endDate: req.body?.end_date,
    });
    res.status(201).json({ period });
  } catch (error) {
    sendError(res, error);
  }
};
