import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const environmentFile = process.env.NODE_ENV === "production"
  ? ".env.production"
  : ".env.development";

dotenv.config({ path: path.resolve(__dirname, "..", environmentFile) });

if (!process.env.DATABASE_URL) {
  throw new Error(`DATABASE_URL is missing from ${environmentFile}`);
}

const databaseUrl = new URL(process.env.DATABASE_URL);
const sql = await fs.readFile(
  path.resolve(__dirname, "..", "sql", "appointment_flow_upgrade.sql"),
  "utf8",
);

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

try {
  console.log(`Applying appointment upgrade to ${databaseUrl.hostname}/${databaseUrl.pathname.slice(1)}...`);
  await client.connect();
  await client.query(sql);
  console.log("Appointment flow database upgrade applied successfully.");
} finally {
  await client.end().catch(() => undefined);
}
