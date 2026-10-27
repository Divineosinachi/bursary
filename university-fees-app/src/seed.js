// Run with: npm run seed
// Sets up fee amounts per level for the current session.
// Edit the amounts below to match your university's actual fees, then re-run.
// (Admins can also change these later from the Admin portal -> Fee amounts page.)
require("dotenv").config();
const db = require("./db");
const { CURRENT_SESSION } = require("./config");

const feeSchedule = [
  { level: "100", school_fee: 150000, hostel_fee: 60000 },
  { level: "200", school_fee: 145000, hostel_fee: 60000 },
  { level: "300", school_fee: 145000, hostel_fee: 60000 },
  { level: "400", school_fee: 140000, hostel_fee: 60000 },
  { level: "500", school_fee: 140000, hostel_fee: 60000 },
];

(async () => {
  try {
    for (const row of feeSchedule) {
      await db.query(
        `INSERT INTO fee_structures (level, session, school_fee, hostel_fee)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (level, session) DO UPDATE SET
           school_fee = EXCLUDED.school_fee,
           hostel_fee = EXCLUDED.hostel_fee`,
        [row.level, CURRENT_SESSION, row.school_fee * 100, row.hostel_fee * 100] // Naira -> kobo
      );
    }

    console.log(`Seeded fee structures for session ${CURRENT_SESSION}:`);
    for (const row of feeSchedule) {
      console.log(
        `  Level ${row.level}: school fee N${row.school_fee.toLocaleString()}, hostel fee N${row.hostel_fee.toLocaleString()}`
      );
    }
  } catch (err) {
    console.error("Seeding failed:", err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
