import { Pool } from "pg";
import { isProduction, loadEnvironment } from "../config/environment.js";

loadEnvironment();

let pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction() ? { rejectUnauthorized: false } : false,
});

pool.connect().catch((err) => console.error("❌ DB connection error:", err));

console.log(`✅ PostgreSQL configuration loaded (${process.env.NODE_ENV})`);

const db = {
  async query(text, params) {
    try {
      const res = await pool.query(text, params);
      return res;
    } catch (error) {
      console.error("error in query", { text });
      throw error;
    }
  },
  async transaction(callback) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export default db;
