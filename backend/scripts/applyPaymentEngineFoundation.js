import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "../models/database.js";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const sqlPaths = [
  path.join(dirname, "../sql/20261026_payment_engine_foundation.sql"),
  path.join(dirname, "../sql/20261026_payment_engine_bank_and_ledger.sql"),
  path.join(dirname, "../sql/20261026_payment_engine_resilience.sql"),
  path.join(dirname, "../sql/20261027_manual_bank_payout_controls.sql"),
];

try {
  for (const sqlPath of sqlPaths) {
    await db.query(fs.readFileSync(sqlPath, "utf8"));
  }
  console.log("Payment Engine foundation, bank-ledger, and resilience migrations applied.");
  process.exit(0);
} catch (error) {
  console.error("Payment Engine foundation migration failed:", error);
  process.exit(1);
}
