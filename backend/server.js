import { connectRedis } from "./config/redis.js";
import http from "http";
import { Server as IOServer } from "socket.io";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";
import pgSession from "connect-pg-simple";
import "./config/passport.js";

dotenv.config();

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
import sectionsRoutes from "./routes/sectionsRoutes.js"

const app = express();

// --- Define __dirname for ES modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ CORS setup
const allowedOrigins = [
  "https://salonmanagementsystemv2.vercel.app",
  "http://localhost:5173"
];

app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.header("Access-Control-Allow-Credentials", "true");
    return res.sendStatus(200);
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json());
app.use(cookieParser());

// --- Sessions ---
const PgSessionStore = pgSession(session);

const isProd = process.env.NODE_ENV === "production";

const sessionStore = new PgSessionStore({
  // PRODUCTION → use DATABASE_URL + SSL
  ...(isProd
    ? {
        conObject: {
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false },
        },
      }
    : {
        // DEVELOPMENT → localhost
        conObject: {
          host: "localhost",
          port: 5433,
          user: "postgres",
          password: "postgres",
          database: "salonmanagementsystemv2_db",
          ssl: false,
        },
      }),
  createTableIfMissing: true,
});


const sessionConfig = {
  store: sessionStore,
  secret: process.env.SESSION_SECRET || "fallback-secret",
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
app.use(session(sessionConfig));


// --- Passport ---
app.use(passport.initialize());
app.use(passport.session());

// --- Static files ---
app.use("/uploads/images", express.static(path.join(__dirname, "/uploads/images")));


// --- Routes ---
app.use("/api/services", servicesRoutes);
app.use("/api/servicet", serviceRoutet);
app.use("/api/expenses", expensesRoutes);
app.use("/api/advances", advancesRoutes);
app.use("/api/clockings", clockingsRoutes);
app.use("/api/sessions", sessionsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/fees", feesRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sections", sectionsRoutes)



// ----------- SOCKET.IO SETUP -----------
const PORT = process.env.PORT || 5500;

// create http server from express app
const server = http.createServer(app);

// configure socket.io
const io = new IOServer(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN
      ? [process.env.CLIENT_ORIGIN, "http://localhost:5173"]
      : allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  // path: "/socket.io", // default, change only if needed
});

// attach io to app for controllers to access
app.set("io", io);
// optional easy global: global.io (use with caution)
global.io = io;

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // you can handle custom events from clients here, e.g. join rooms
  socket.on("join_room", (room) => {
    console.log(`Socket ${socket.id} joining room ${room}`);
    socket.join(room);
  });

  socket.on("disconnect", (reason) => {
    console.log("🔴 Socket disconnected:", socket.id, "reason:", reason);
  });
});

// start server
(async () => {
  try {
    await connectRedis();

    server.listen(PORT, () =>
      console.log(`✅ Server running on port ${PORT}`)
    );
  } catch (err) {
    console.error("❌ Failed to start server:", err);
  }
})();



