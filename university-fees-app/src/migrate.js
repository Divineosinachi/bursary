// Run with: npm run migrate
// Creates all tables in your Supabase database from database/schema.sql.
// Safe to run again — it only creates what's missing.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("./db");

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, "..", "database", "schema.sql"), "utf8");
    await db.query(sql);
    console.log("Database is ready: tables created in Supabase.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
