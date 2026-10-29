import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "../models/database.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(dirname, "../sql/20261029_financial_audit_foundation.sql");

try {
  await db.query(fs.readFileSync(sqlPath, "utf8"));
  console.log("Financial audit foundation migration applied.");
  process.exit(0);
} catch (error) {
  console.error("Financial audit foundation migration failed:", error.message);
  process.exit(1);
}
