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
