import fs from "fs/promises";
import path from "path";
import db from "../models/database.js";

const file = path.join(process.cwd(), "sql", "20261010_owner_intelligence.sql");
const sql = await fs.readFile(file, "utf8");
await db.query(sql);
console.log("Owner intelligence schema applied.");
process.exit(0);
