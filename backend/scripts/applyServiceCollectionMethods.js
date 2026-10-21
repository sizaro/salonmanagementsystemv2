import fs from "fs/promises";
import path from "path";
import db from "../models/database.js";

const sqlPath = path.join(
  process.cwd(),
  "sql",
  "20261020_service_collection_methods.sql",
);

await db.query(await fs.readFile(sqlPath, "utf8"));
console.log("Service collection-method upgrade applied.");
process.exit(0);
