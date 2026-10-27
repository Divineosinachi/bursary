const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const asyncHandler = require("../utils/asyncHandler");
const { logAction } = require("../utils/audit");
const { requireRole } = require("../middleware/authMiddleware");
const {
  CURRENT_SESSION,
  VALID_LEVELS,
  EMAIL_REGEX,
  PASSWORD_REGEX,
  PASSWORD_RULE_MESSAGE,
} = require("../config");

// Admin-only actions: managing staff accounts, fee amounts and reading the audit log.
const router = express.Router();
router.use(requireRole("admin"));

function requestedSession(value) {
  const session = value === undefined
    ? CURRENT_SESSION
    : typeof value === "string"
      ? value.trim()
      : null;
  return typeof session === "string" && /^\d{4}\/\d{4}$/.test(session) ? session : null;
}

// ---------- Staff accounts ----------

router.get(
  "/staff",
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT id, full_name, email, role, department, is_active, created_at
       FROM staff_users ORDER BY role, full_name`
    );
    res.json(rows);
  })
);

router.post(
  "/staff",
  asyncHandler(async (req, res) => {
    const { full_name, email, password, role, department } = req.body || {};

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: "Name, email and a temporary password are required." });
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
    }
    const accountRole = role === "admin" ? "admin" : "staff";
    const cleanEmail = email.toLowerCase().trim();

    const existing = await db.query("SELECT id FROM staff_users WHERE email = $1", [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "A staff account with this email already exists." });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `INSERT INTO staff_users (full_name, email, password_hash, role, department)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [full_name.trim(), cleanEmail, hash, accountRole, (department || "").trim() || null]
    );

    await logAction(req.user, "create_staff_account", {
      staff_id: rows[0].id,
      email: cleanEmail,
      role: accountRole,
    });
    res.status(201).json({ id: rows[0].id });
  })
);

router.patch(
  "/staff/:id/active",
  asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const isActive = req.body && req.body.is_active === true;

    if (id === req.user.id) {
      return res.status(400).json({ error: "You can't deactivate your own account." });
    }

    const { rows } = await db.query(
      "UPDATE staff_users SET is_active = $1 WHERE id = $2 RETURNING id, email",
      [isActive, id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Staff account not found." });

    await logAction(req.user, isActive ? "activate_staff_account" : "deactivate_staff_account", {
      staff_id: id,
      email: rows[0].email,
    });
    res.json({ ok: true });
  })
);

// ---------- Fee amounts ----------

router.get(
  "/fees",
  asyncHandler(async (req, res) => {
    const session = requestedSession(req.query.session);
    if (!session) return res.status(400).json({ error: "Enter an academic session in YYYY/YYYY format." });
    const { rows } = await db.query(
      "SELECT level, session, school_fee, hostel_fee FROM fee_structures WHERE session = $1",
      [session]
    );
    const byLevel = Object.fromEntries(rows.map((r) => [r.level, r]));
    const sessionResult = await db.query("SELECT DISTINCT session FROM fee_structures ORDER BY session DESC");

    // Always return every level, so the admin can fill in ones not set up yet.
    res.json({
      session,
      sessions: sessionResult.rows.map((row) => row.session),
      levels: VALID_LEVELS.map((level) => ({
        level,
        school_fee_naira: byLevel[level] ? Number(byLevel[level].school_fee) / 100 : null,
        hostel_fee_naira: byLevel[level] ? Number(byLevel[level].hostel_fee) / 100 : null,
      })),
    });
  })
);

router.put(
  "/fees",
  asyncHandler(async (req, res) => {
    const { level, school_fee_naira, hostel_fee_naira } = req.body || {};
    const session = requestedSession(req.body && req.body.session);
    const school = Number(school_fee_naira);
    const hostel = Number(hostel_fee_naira);

    if (!session) {
      return res.status(400).json({ error: "Enter an academic session in YYYY/YYYY format." });
    }
    if (!VALID_LEVELS.includes(String(level))) {
      return res.status(400).json({ error: "Select a valid level." });
    }
    if (!Number.isFinite(school) || !Number.isFinite(hostel) || school < 0 || hostel < 0) {
      return res.status(400).json({ error: "Fee amounts must be zero or more." });
    }

    await db.query(
      `INSERT INTO fee_structures (level, session, school_fee, hostel_fee)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (level, session) DO UPDATE SET
         school_fee = EXCLUDED.school_fee,
         hostel_fee = EXCLUDED.hostel_fee`,
      [String(level), session, Math.round(school * 100), Math.round(hostel * 100)]
    );

    await logAction(req.user, "update_fees", {
      level: String(level),
      session,
      school_fee_naira: school,
      hostel_fee_naira: hostel,
    });
    res.json({ ok: true });
  })
);

// ---------- Audit log ----------

router.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT id, actor_role, actor_name, action, details, created_at
       FROM audit_logs ORDER BY created_at DESC LIMIT 200`
    );
    res.json(rows);
  })
);

module.exports = router;
