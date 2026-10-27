// Run with: npm run create-admin -- "Full Name" admin@school.edu "StrongPass1!"
// Creates the first admin account (further staff/admins are made from the Admin portal).
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");
const { EMAIL_REGEX, PASSWORD_REGEX, PASSWORD_RULE_MESSAGE } = require("./config");

(async () => {
  const [fullName, email, password] = process.argv.slice(2);

  try {
    if (!fullName || !email || !password) {
      throw new Error('Usage: npm run create-admin -- "Full Name" admin@school.edu "StrongPass1!"');
    }
    if (!EMAIL_REGEX.test(email)) throw new Error("That email address doesn't look valid.");
    if (!PASSWORD_REGEX.test(password)) throw new Error(PASSWORD_RULE_MESSAGE);

    const cleanEmail = email.toLowerCase().trim();
    const existing = await db.query("SELECT id FROM staff_users WHERE email = $1", [cleanEmail]);
    if (existing.rows.length > 0) throw new Error("An account with that email already exists.");

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      `INSERT INTO staff_users (full_name, email, password_hash, role, department)
       VALUES ($1, $2, $3, 'admin', 'Administration')`,
      [fullName.trim(), cleanEmail, hash]
    );
    console.log(`Admin account created for ${cleanEmail}. Log in at /admin/login.html`);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
})();
