import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import db from "../models/database.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(here, "..", "sql", "20261009_employee_profile_audit.sql");

try {
  await db.query(await fs.readFile(sqlPath, "utf8"));
  console.log("Employee profile audit database upgrade completed.");
  process.exit(0);
} catch (error) {
  console.error("Employee profile audit upgrade failed:", error.message);
  process.exit(1);
}
