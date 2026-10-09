import dotenv from "dotenv";
import path from "path";

let loaded = false;

/**
 * Loads one predictable configuration stack everywhere in the API.
 * `.env` holds shared local defaults and `.env.<environment>` overrides it.
 */
export function loadEnvironment() {
  if (loaded) return process.env.NODE_ENV;

  const root = process.cwd();
  dotenv.config({ path: path.join(root, ".env") });

  const environment = String(process.env.NODE_ENV || "development").trim().toLowerCase();
  process.env.NODE_ENV = environment;
  dotenv.config({ path: path.join(root, `.env.${environment}`), override: true });

  if (environment === "production" && !String(process.env.SESSION_SECRET || "").trim()) {
    throw new Error("SESSION_SECRET must be configured before the production API can start.");
  }
  if (!String(process.env.DATABASE_URL || "").trim()) {
    throw new Error("DATABASE_URL must be configured before the API can start.");
  }

  loaded = true;
  return environment;
}

export const isProduction = () => loadEnvironment() === "production";

export function allowedOrigins() {
  loadEnvironment();
  const configured = String(process.env.ALLOWED_ORIGINS || process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set([
    ...configured,
    "https://salonmanagementsystemv2.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://192.168.1.104:8081",
  ])];
}

export function isTrustedOrigin(origin) {
  return !origin || allowedOrigins().includes(origin);
}
