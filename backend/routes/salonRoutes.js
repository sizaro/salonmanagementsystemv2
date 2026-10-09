import express from "express";
import { setupSalonStep1 } from "../controllers/salonController.js";
import { requireAuth, requireRole, requireSalonContext } from "../middleware/auth.js";

const router = express.Router();


// A live salon should not expose tenant creation publicly. Bootstrap can be
// enabled temporarily with ALLOW_PUBLIC_SALON_SETUP=true; normal operation is
// owner-only and uses the authenticated salon context.
router.post("/setup-step1", (req, res, next) => {
  if (process.env.ALLOW_PUBLIC_SALON_SETUP === "true") return setupSalonStep1(req, res, next);
  return requireAuth(req, res, () => requireSalonContext(req, res, () => requireRole("owner")(req, res, () => setupSalonStep1(req, res, next))));
});

export default router;
