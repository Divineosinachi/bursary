const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { rateLimit } = require("express-rate-limit");
const db = require("../db");
const asyncHandler = require("../utils/asyncHandler");
const { sendPasswordResetEmail } = require("../utils/mailer");
const { logAction } = require("../utils/audit");
const { signToken, requireRole } = require("../middleware/authMiddleware");
const {
  VALID_LEVELS,
  EMAIL_REGEX,
  PASSWORD_REGEX,
  PASSWORD_RULE_MESSAGE,
} = require("../config");

const router = express.Router();
const PASSWORD_RESET_ROLES = new Set(["student", "staff", "admin"]);
const PASSWORD_RESET_MESSAGE =
  "If an account matches that email, a password reset link will be sent shortly.";
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many password reset attempts. Try again in 15 minutes." },
});

// ---------- Student ----------

router.post(
  "/student/register",
  asyncHandler(async (req, res) => {
    const { full_name, email, matric_number, password, level } = req.body || {};

    if (!full_name || !email || !matric_number || !password || !level) {
      return res.status(400).json({ error: "All fields are required." });
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
    }
    if (!VALID_LEVELS.includes(String(level))) {
      return res.status(400).json({ error: "Select a valid level." });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanMatric = matric_number.trim();

    const existing = await db.query(
      "SELECT id FROM students WHERE email = $1 OR matric_number = $2",
      [cleanEmail, cleanMatric]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with this email or matric number already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO students (full_name, email, matric_number, password_hash, level)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [full_name.trim(), cleanEmail, cleanMatric, passwordHash, String(level)]
    );

    res.status(201).json({ token: signToken({ id: rows[0].id, role: "student" }) });
  })
);

router.post(
  "/student/login",
  asyncHandler(async (req, res) => {
    const { identifier, email, password } = req.body || {};
    const loginIdentifier = (identifier || email || "").trim();
    if (!loginIdentifier || !password) {
      return res.status(400).json({ error: "Email or matric number and password are required." });
    }

    const { rows } = await db.query(
      "SELECT id, password_hash FROM students WHERE email = $1 OR matric_number = $2",
      [loginIdentifier.toLowerCase(), loginIdentifier]
    );
    const student = rows[0];

    if (!student || !(await bcrypt.compare(password, student.password_hash))) {
      return res.status(401).json({ error: "Incorrect email, matric number or password." });
    }

    res.json({ token: signToken({ id: student.id, role: "student" }) });
  })
);

// ---------- Staff and admin ----------
// Same table, but each portal only lets in its own role, so a staff account
// can never log in through the admin portal (and vice versa).

function staffLogin(role) {
  return asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const { rows } = await db.query(
      "SELECT id, full_name, password_hash, role, is_active FROM staff_users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    const user = rows[0];

    if (!user || user.role !== role || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    if (!user.is_active) {
      return res.status(403).json({ error: "This account has been deactivated. Contact an administrator." });
    }

    await logAction({ role: user.role, id: user.id, name: user.full_name }, "login");
    res.json({ token: signToken({ id: user.id, role: user.role }) });
  });
}

router.post("/staff/login", staffLogin("staff"));
router.post("/admin/login", staffLogin("admin"));

// ---------- Password reset ----------

router.post(
  "/password-reset/request",
  passwordResetLimiter,
  asyncHandler(async (req, res) => {
    const { email, portal: role } = req.body || {};
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!PASSWORD_RESET_ROLES.has(role) || !EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: "Enter a valid email and portal." });
    }

    let account;
    if (role === "student") {
      const result = await db.query(
        "SELECT id, email FROM students WHERE email = $1",
        [cleanEmail]
      );
      account = result.rows[0];
    } else {
      const result = await db.query(
        "SELECT id, email FROM staff_users WHERE email = $1 AND role = $2 AND is_active = TRUE",
        [cleanEmail, role]
      );
      account = result.rows[0];
    }

    if (!account) return res.json({ message: PASSWORD_RESET_MESSAGE });

    await db.query(
      "DELETE FROM password_reset_tokens WHERE created_at <= now() - interval '1 hour'"
    );
    const recentRequests = await db.query(
      `SELECT COUNT(*) AS count FROM password_reset_tokens
       WHERE user_role = $1 AND user_id = $2 AND created_at > now() - interval '1 hour'`,
      [role, account.id]
    );
    if (Number(recentRequests.rows[0].count) >= 3) {
      return res.json({ message: PASSWORD_RESET_MESSAGE });
    }

    const baseUrl = (process.env.APP_BASE_URL || "").replace(/\/+$/, "");
    if (!baseUrl) throw new Error("APP_BASE_URL is required to send password reset links.");

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await db.query(
      `UPDATE password_reset_tokens SET used_at = now()
       WHERE user_role = $1 AND user_id = $2 AND used_at IS NULL`,
      [role, account.id]
    );
    await db.query(
      `INSERT INTO password_reset_tokens (token_hash, user_role, user_id, expires_at)
       VALUES ($1, $2, $3, now() + interval '30 minutes')`,
      [tokenHash, role, account.id]
    );

    const resetUrl = `${baseUrl}/reset-password.html?portal=${encodeURIComponent(role)}&token=${rawToken}`;

    try {
      await sendPasswordResetEmail({ email: account.email, resetUrl });
    } catch (error) {
      await db.query(
        "DELETE FROM password_reset_tokens WHERE token_hash = $1",
        [tokenHash]
      );
      throw error;
    }

    res.json({ message: PASSWORD_RESET_MESSAGE });
  })
);

router.post(
  "/password-reset/complete",
  passwordResetLimiter,
  asyncHandler(async (req, res) => {
    const { token, portal: role, new_password: newPassword } = req.body || {};
    if (
      !PASSWORD_RESET_ROLES.has(role) ||
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token)
    ) {
      return res.status(400).json({ error: "This password reset link is invalid or has expired." });
    }
    if (typeof newPassword !== "string" || !PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");
      const tokenResult = await client.query(
        `SELECT user_id FROM password_reset_tokens
         WHERE token_hash = $1 AND user_role = $2
           AND used_at IS NULL AND expires_at > now()
         FOR UPDATE`,
        [tokenHash, role]
      );
      if (!tokenResult.rows[0]) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "This password reset link is invalid or has expired." });
      }

      const table = role === "student" ? "students" : "staff_users";
      const activeAccountCondition = role === "student" ? "" : " AND is_active = TRUE";
      const updateResult = await client.query(
        `UPDATE ${table} SET password_hash = $1 WHERE id = $2${activeAccountCondition}
         RETURNING full_name`,
        [passwordHash, tokenResult.rows[0].user_id]
      );
      if (updateResult.rowCount !== 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "This password reset link is invalid or has expired." });
      }

      await client.query(
        `UPDATE password_reset_tokens SET used_at = now()
         WHERE user_role = $1 AND user_id = $2 AND used_at IS NULL`,
        [role, tokenResult.rows[0].user_id]
      );
      await client.query("COMMIT");
      if (role !== "student") {
        await logAction(
          { role, id: tokenResult.rows[0].user_id, name: updateResult.rows[0].full_name },
          "password_reset"
        );
      }
      res.json({ message: "Your password has been reset. You can now log in." });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

// ---------- Who am I (any logged-in role) ----------

router.get(
  "/me",
  requireRole("student", "staff", "admin"),
  asyncHandler(async (req, res) => {
    if (req.user.role === "student") {
      const { rows } = await db.query(
        `SELECT full_name, email, matric_number, level, phone_number, permanent_address,
                contact_address, state_of_origin, lga_of_origin, home_town
         FROM students WHERE id = $1`,
        [req.user.id]
      );
      return res.json({ role: "student", ...rows[0] });
    }
    const { rows } = await db.query(
      "SELECT full_name, email, role, department FROM staff_users WHERE id = $1",
      [req.user.id]
    );
    res.json({ ...rows[0] });
  })
);

router.put(
  "/student/profile",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    res.status(403).json({ error: "Only an administrator can change student information. Please contact the bursary office." });
  })
);

// ---------- Change password (any logged-in role) ----------

router.post(
  "/change-password",
  requireRole("student", "staff", "admin"),
  asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body || {};
    if (!current_password || !new_password) {
      return res.status(400).json({ error: "Enter your current password and a new one." });
    }
    if (!PASSWORD_REGEX.test(new_password)) {
      return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
    }

    const table = req.user.role === "student" ? "students" : "staff_users";
    const { rows } = await db.query(`SELECT password_hash FROM ${table} WHERE id = $1`, [req.user.id]);

    if (!rows[0] || !(await bcrypt.compare(current_password, rows[0].password_hash))) {
      return res.status(400).json({ error: "Your current password is incorrect." });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await db.query(`UPDATE ${table} SET password_hash = $1 WHERE id = $2`, [newHash, req.user.id]);

    if (req.user.role !== "student") await logAction(req.user, "change_password");
    res.json({ ok: true });
  })
);

module.exports = router;
