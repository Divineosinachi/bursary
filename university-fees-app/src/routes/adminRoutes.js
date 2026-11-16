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

const STUDENT_PROFILE_FIELDS = [
  ["phone_number", 32],
  ["permanent_address", 250],
  ["contact_address", 250],
  ["state_of_origin", 100],
  ["lga_of_origin", 100],
  ["home_town", 100],
];

function requestedSession(value) {
  const session = value === undefined
    ? CURRENT_SESSION
    : typeof value === "string"
      ? value.trim()
      : null;
  return typeof session === "string" && /^\d{4}\/\d{4}$/.test(session) ? session : null;
}

// ---------- Student records ----------

router.get(
  "/students/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid student ID." });
    }

    const { rows } = await db.query(
      `SELECT id, full_name, email, matric_number, level, phone_number,
              permanent_address, contact_address, state_of_origin, lga_of_origin,
              home_town, created_at
       FROM students WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Student not found." });
    res.json(rows[0]);
  })
);

router.put(
  "/students/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({ error: "Invalid student ID." });
    }

    const { full_name, email, matric_number, level } = req.body || {};
    if ([full_name, email, matric_number, level].some((value) => typeof value !== "string" || !value.trim())) {
      return res.status(400).json({ error: "Name, email, matric number and academic level are required." });
    }

    const cleanName = full_name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMatric = matric_number.trim();
    const cleanLevel = level.trim();
    if (cleanName.length > 150) {
      return res.status(400).json({ error: "Student name must be 150 characters or fewer." });
    }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }
    if (cleanEmail.length > 254) {
      return res.status(400).json({ error: "Email address must be 254 characters or fewer." });
    }
    if (cleanMatric.length > 64) {
      return res.status(400).json({ error: "Matric number must be 64 characters or fewer." });
    }
    if (!VALID_LEVELS.includes(cleanLevel)) {
      return res.status(400).json({ error: "Select a valid academic level." });
    }

    const profileValues = [];
    for (const [field, maxLength] of STUDENT_PROFILE_FIELDS) {
      const value = req.body[field];
      if (value !== undefined && value !== null && typeof value !== "string") {
        return res.status(400).json({ error: `${field.replaceAll("_", " ")} must be text.` });
      }
      const cleanValue = typeof value === "string" ? value.trim() : "";
      if (cleanValue.length > maxLength) {
        return res.status(400).json({
          error: `${field.replaceAll("_", " ")} must be ${maxLength} characters or fewer.`,
        });
      }
      profileValues.push(cleanValue || null);
    }
    if (profileValues[0] && !/^[+()\d.\-\s]{7,32}$/.test(profileValues[0])) {
      return res.status(400).json({ error: "Enter a valid phone number." });
    }

    const { rows: previousRows } = await db.query(
      `SELECT full_name, email, matric_number, level, phone_number, permanent_address,
              contact_address, state_of_origin, lga_of_origin, home_town
       FROM students WHERE id = $1`,
      [id]
    );
    const previous = previousRows[0];
    if (!previous) return res.status(404).json({ error: "Student not found." });

    const duplicate = await db.query(
      "SELECT email, matric_number FROM students WHERE id != $1 AND (email = $2 OR matric_number = $3)",
      [id, cleanEmail, cleanMatric]
    );
    if (duplicate.rows.some((row) => row.email === cleanEmail)) {
      return res.status(409).json({ error: "Another student already uses this email address." });
    }
    if (duplicate.rows.some((row) => row.matric_number === cleanMatric)) {
      return res.status(409).json({ error: "Another student already uses this matric number." });
    }

    let rows;
    try {
      ({ rows } = await db.query(
        `UPDATE students
         SET full_name = $1, email = $2, matric_number = $3, level = $4,
             phone_number = $5, permanent_address = $6, contact_address = $7,
             state_of_origin = $8, lga_of_origin = $9, home_town = $10
         WHERE id = $11
         RETURNING id, full_name, email, matric_number, level, phone_number,
                   permanent_address, contact_address, state_of_origin, lga_of_origin,
                   home_town, created_at`,
        [cleanName, cleanEmail, cleanMatric, cleanLevel, ...profileValues, id]
      ));
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({ error: "Another student already uses that email address or matric number." });
      }
      throw error;
    }
    if (!rows[0]) return res.status(404).json({ error: "Student not found." });

    const updatedValues = {
      full_name: cleanName,
      email: cleanEmail,
      matric_number: cleanMatric,
      level: cleanLevel,
      ...Object.fromEntries(STUDENT_PROFILE_FIELDS.map(([field], index) => [field, profileValues[index]])),
    };
    await logAction(req.user, "update_student_information", {
      student_id: id,
      updated_fields: Object.keys(updatedValues).filter((field) => {
        const oldValue = previous[field] == null ? "" : String(previous[field]);
        const newValue = updatedValues[field] == null ? "" : String(updatedValues[field]);
        return oldValue !== newValue;
      }),
    });
    res.json({ student: rows[0] });
  })
);

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
