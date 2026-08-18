import { fetchTodaySalonSession } from "../models/sessionsModel.js";

export const requireAuth = (req, res, next) => {
  if (!req.isAuthenticated?.() || !req.user?.id || !req.user?.salon_id) {
    return res.status(401).json({ error: "Authentication is required" });
  }
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: "You do not have permission for this action" });
  }
  next();
};

export const requireSalonContext = (req, res, next) => {
  req.salon_id = Number(req.user?.salon_id);
  if (!req.salon_id) return res.status(400).json({ error: "Salon context missing" });
  next();
};

export const requireOpenSalon = async (req, res, next) => {
  if (!['manager', 'cashier'].includes(req.user?.role)) return next();
  try {
    const session = await fetchTodaySalonSession(Number(req.user.salon_id));
    if (!session) {
      return res.status(423).json({
        error: "Open the salon before using operational dashboard tools",
        code: "SALON_CLOSED",
      });
    }
    req.salonSession = session;
    next();
  } catch (error) {
    console.error("Unable to verify salon session:", error);
    res.status(500).json({ error: "Unable to verify the salon session" });
  }
};
