import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import db from "../models/database.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(
  here,
  "..",
  "sql",
  "20261008_employee_finance_foundation.sql",
);

try {
  const sql = await fs.readFile(sqlPath, "utf8");
  await db.query(sql);
  console.log(
    "Employee finance foundation completed. Existing services and advances were preserved.",
  );
  process.exit(0);
} catch (error) {
  console.error("Employee finance foundation failed:", error.message);
  process.exit(1);
}
