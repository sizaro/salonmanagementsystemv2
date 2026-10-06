import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import db from "../models/database.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(here, "..", "sql", "20261005_historical_business_records_and_employee_id_evidence.sql");

try {
  const sql = await fs.readFile(sqlPath, "utf8");
  await db.query(sql);
  console.log("Historical-record and employee-ID database upgrade completed.");
  process.exit(0);
} catch (error) {
  console.error("Database upgrade failed:", error.message);
  process.exit(1);
}
