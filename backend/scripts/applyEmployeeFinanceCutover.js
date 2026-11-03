import fs from "fs/promises";
import path from "path";
import db from "../models/database.js";

const sqlPath = path.join(
  process.cwd(),
  "sql",
  "20261021_employee_finance_cutover.sql",
);

await db.query(await fs.readFile(sqlPath, "utf8"));
console.log("Employee-finance cutover applied.");
process.exit(0);
