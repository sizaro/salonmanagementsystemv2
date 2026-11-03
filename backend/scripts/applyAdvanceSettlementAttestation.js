import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import db from "../models/database.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(here, "..", "sql", "20261022_advance_settlement_attestation.sql");

try {
  await db.query(await fs.readFile(sqlPath, "utf8"));
  console.log("Advance settlement attestation database upgrade completed.");
  process.exit(0);
} catch (error) {
  console.error("Advance settlement attestation upgrade failed:", error.message);
  process.exit(1);
}
