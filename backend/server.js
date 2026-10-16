import { connectRedis } from "./config/redis.js";
import http from "http";
import { Server as IOServer } from "socket.io";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import pgSession from "connect-pg-simple";
import "./config/passport.js";
import db from "./models/database.js";
import {
  allowedOrigins,
  isProduction,
  loadEnvironment,
} from "./config/environment.js";
import {
  apiRateLimiter,
  attachRequestId,
  errorHandler,
  notFound,
  requireTrustedOrigin,
  uploadRateLimiter,
} from "./middleware/security.js";
// import { checkSetupStatus } from "../controllers/setupController.js";

loadEnvironment();

import servicesRoutes from "./routes/servicesRoutes.js";
import serviceRoutet from "./routes/serviceRoutet.js";
import expensesRoutes from "./routes/expensesRoutes.js";
import advancesRoutes from "./routes/advancesRoutes.js";
import clockingsRoutes from "./routes/clockingsRoutes.js";
import sessionsRoutes from "./routes/sessionsRoutes.js";
import usersRoutes from "./routes/usersRoutes.js";
import reportsRoutes from "./routes/reportsRoutes.js";
import feesRoutes from "./routes/feesRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import sectionsRoutes from "./routes/sectionsRoutes.js";
import salonRoutes from "./routes/salonRoutes.js";
import salonProfileRoutes from "./routes/salonProfileRoutes.js";
import mobileAuthRoutes from "./routes/mobileAuth.js";
import employeeFinanceRoutes from "./routes/employeeFinanceRoutes.js";
import employeeFinanceOperationsRoutes from "./routes/employeeFinanceOperationsRoutes.js";
import employeeProfileRoutes from "./routes/employeeProfileRoutes.js";
import ownerIntelligenceRoutes from "./routes/ownerIntelligenceRoutes.js";
import publicCampaignRoutes from "./routes/publicCampaignRoutes.js";
import statisticsRoutes from "./routes/statisticsRoutes.js";
import {
  requireAuth,
  requireRole,
  requireSalonContext,
  requireOpenSalon,
} from "./middleware/auth.js";

const app = express();

// --- Define __dirname for ES modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ CORS setup
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins().includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(attachRequestId);
app.use("/api", apiRateLimiter, requireTrustedOrigin);
app.use(express.json({ limit: "3mb" }));
app.use(cookieParser());

// --- Sessions ---
const PgSessionStore = pgSession(session);

const isProd = isProduction();

/*
 * TEMPORARY REMOTE DATABASE CHECK
 *
 * Normally, development sessions use the local PostgreSQL database
 * running through Docker on localhost:5433.
 *
 * For the current recovery/data inspection, .env.development points
 * DATABASE_URL to the remote salon_db_oct database.
 *
 * The session store must temporarily use that same remote database,
 * otherwise login attempts try localhost:5433 and fail with ECONNREFUSED.
 *
 * IMPORTANT:
 * After the remote database inspection/recovery work is complete,
 * restore the normal development session configuration that points
 * to the local Docker PostgreSQL database.
 */

const sessionStore = new PgSessionStore({
  conObject: {
    connectionString: process.env.DATABASE_URL,
    ssl: isProd ? { rejectUnauthorized: false } : false,
  },
  createTableIfMissing: true,
});

const sessionConfig = {
  store: sessionStore,
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "None" : "Lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
};

app.set("trust proxy", 1);
const sessionMiddleware = session(sessionConfig);
app.use(sessionMiddleware);

// --- Passport ---
app.use(passport.initialize());
app.use(passport.session());

// --- Static files ---
app.use(
  "/uploads/images",
  (req, res, next) => {
    // Legacy identity evidence and finance signatures are never public files.
    if (/^(national-id-|receipt-signature-)/i.test(path.basename(req.path))) {
      return res
        .status(404)
        .json({ error: "File not found", requestId: req.requestId });
    }
    next();
  },
  express.static(path.join(__dirname, "/uploads/images")),
);

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", database: "ok", requestId: req.requestId });
  } catch {
    res.status(503).json({
      status: "degraded",
      database: "unavailable",
      requestId: req.requestId,
    });
  }
});

// --- Routes ---
app.use(
  "/api/salon-profile",
  requireAuth,
  requireSalonContext,
  requireRole("owner"),
  salonProfileRoutes,
);
app.use("/api/marketplace", publicCampaignRoutes);
app.use("/api/statistics", requireAuth, requireSalonContext, statisticsRoutes);
app.use("/api/services", servicesRoutes);

app.use(
  "/api/servicet",
  requireAuth,
  requireSalonContext,
  requireRole("owner", "manager", "cashier"),
  requireOpenSalon,
  serviceRoutet,
);

app.use(
  "/api/expenses",
  requireAuth,
  requireSalonContext,
  requireRole("owner", "manager", "cashier"),
  requireOpenSalon,
  expensesRoutes,
);

app.use(
  "/api/advances",
  requireAuth,
  requireSalonContext,
  requireRole("owner", "manager", "cashier"),
  requireOpenSalon,
  advancesRoutes,
);

app.use(
  "/api/clockings",
  requireAuth,
  requireSalonContext,
  requireRole("owner", "manager", "cashier"),
  requireOpenSalon,
  clockingsRoutes,
);

app.use("/api/sessions", requireAuth, requireSalonContext, sessionsRoutes);

app.use(
  "/api/employee-finance",
  requireAuth,
  requireSalonContext,
  employeeFinanceRoutes,
);

app.use(
  "/api/employee-profiles",
  requireAuth,
  requireSalonContext,
  employeeProfileRoutes,
);

app.use(
  "/api/employee-finance",
  requireAuth,
  requireSalonContext,
  employeeFinanceOperationsRoutes,
);

app.use("/api/users", uploadRateLimiter, usersRoutes);

app.use(
  "/api/reports",
  requireAuth,
  requireSalonContext,
  requireOpenSalon,
  reportsRoutes,
);

app.use(
  "/api/owner-intelligence",
  requireAuth,
  requireSalonContext,
  requireOpenSalon,
  ownerIntelligenceRoutes,
);

app.use(
  "/api/fees",
  requireAuth,
  requireSalonContext,
  requireRole("owner"),
  feesRoutes,
);

app.use("/api/auth", authRoutes);
app.use("/api/sections", sectionsRoutes);
app.use("/api/salon", salonRoutes);
app.use("/api/mobile", mobileAuthRoutes);

// ----------- SOCKET.IO SETUP -----------
const PORT = Number(process.env.PORT || 5500);

// create http server from express app
const server = http.createServer(app);

// configure socket.io
const io = new IOServer(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN
      ? [process.env.CLIENT_ORIGIN, "http://localhost:5173"]
      : allowedOrigins(),
    methods: ["GET", "POST"],
    credentials: true,
  },
  // path: "/socket.io", // default, change only if needed
});

// attach io to app for controllers to access
app.set("io", io);

// optional easy global: global.io (use with caution)
global.io = io;

io.engine.use(sessionMiddleware);
io.engine.use(passport.initialize());
io.engine.use(passport.session());

io.use((socket, next) => {
  const user = socket.request.user;

  if (!user?.id || !user?.salon_id) {
    return next(new Error("Authentication required"));
  }

  next();
});

io.on("connection", (socket) => {
  socket.join(`salon:${socket.request.user.salon_id}`);
  socket.join(`user:${socket.request.user.id}`);

  socket.on("disconnect", () => {});
});

app.use(notFound);
app.use(errorHandler);

// start server
(async () => {
  try {
    // --- Connect Redis only in local development ---
    if (process.env.NODE_ENV !== "production") {
      try {
        await connectRedis();
        console.log("✅ Redis connected (development)");
      } catch (err) {
        console.error("❌ Failed to connect Redis:", err);
      }
    } else {
      console.log("Redis skipped in production");
    }

    // --- Start server ---
    server.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
  }
})();
