import { listAuditEvents } from "../models/auditModel.js";

export const getAuditEvents = async (req, res) => {
  try {
    const events = await listAuditEvents({
      salonId: req.salon_id,
      limit: req.query.limit,
      offset: req.query.offset,
      module: req.query.module,
      recordType: req.query.record_type,
      recordId: req.query.record_id,
    });
    return res.json({ data: events, limit: Math.max(1, Math.min(Number(req.query.limit) || 50, 200)) });
  } catch (error) {
    console.error("Unable to load audit history", { requestId: req.requestId, message: error.message });
    return res.status(500).json({ error: "Unable to load audit history", requestId: req.requestId });
  }
};
