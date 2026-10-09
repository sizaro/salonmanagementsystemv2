import { getStatisticsReport, statisticsOptions } from "../models/statisticsModel.js";

const respond = (res, error) => res.status(error.statusCode || 500).json({
  error: error.statusCode ? error.message : "Unable to prepare the statistics report",
});

export async function getStatisticsOptions(_req, res) {
  res.json({ areas: statisticsOptions });
}

export async function getStatistics(req, res) {
  try {
    const report = await getStatisticsReport({ salonId: req.salon_id, query: req.query });
    res.json({ report });
  } catch (error) {
    respond(res, error);
  }
}
