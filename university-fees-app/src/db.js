const { Pool, types } = require("pg");

// Postgres returns BIGINT / COUNT() / SUM() as strings by default. Our money
// values (kobo) and counts are well inside JavaScript's safe integer range,
// so turn them into plain numbers.
types.setTypeParser(20, (v) => parseInt(v, 10)); // int8 (BIGINT, COUNT)
types.setTypeParser(1700, (v) => parseFloat(v)); // numeric (SUM of BIGINT)

if (!process.env.DATABASE_URL) {
  console.warn(
    "Warning: DATABASE_URL is not set in .env — the app cannot reach the Supabase database until it is."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL. Set DATABASE_SSL=false only for a local Postgres.
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  max: 10,
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
