import fs from "fs/promises";
import path from "path";
import db from "../models/database.js";

const sqlPath = path.join(process.cwd(), "sql", "20261019_historical_employee_finance_entries.sql");
await db.query(await fs.readFile(sqlPath, "utf8"));
console.log("Historical employee finance entry upgrade applied.");
await db.pool.end();
