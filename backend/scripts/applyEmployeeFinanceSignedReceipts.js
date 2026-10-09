import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import db from "../models/database.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(here, "..", "sql", "20261009_employee_finance_signed_receipts.sql");

try {
  await db.query(await fs.readFile(sqlPath, "utf8"));
  console.log("Signed employee finance receipt database upgrade completed.");
  process.exit(0);
} catch (error) {
  console.error("Signed employee finance receipt upgrade failed:", error.message);
  process.exit(1);
}
