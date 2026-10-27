const express = require("express");
const db = require("../db");
const asyncHandler = require("../utils/asyncHandler");
const { requireRole } = require("../middleware/authMiddleware");
const { buildFee, CURRENT_SESSION } = require("./feeRoutes");

// Read-only views of students and payments. Used by the staff portal, and
// reused by the admin portal (admins are allowed in too).
const router = express.Router();
router.use(requireRole("staff", "admin"));

// Escape % and _ so a search for "100%" doesn't act as a wildcard.
function likePattern(q) {
  return `%${String(q || "").trim().replace(/[\\%_]/g, "\\$&")}%`;
}

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const students = await db.query("SELECT COUNT(*) AS n FROM students");

    const totals = await db.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status = 'success'), 0) AS collected,
         COALESCE(SUM(amount) FILTER (WHERE status = 'success' AND fee_type = 'school'), 0) AS school_collected,
         COALESCE(SUM(amount) FILTER (WHERE status = 'success' AND fee_type = 'hostel'), 0) AS hostel_collected,
         COUNT(*) FILTER (WHERE status = 'success') AS successful,
         COUNT(*) FILTER (WHERE status = 'pending') AS pending,
         COUNT(*) FILTER (WHERE status = 'failed') AS failed
       FROM payments WHERE session = $1`,
      [CURRENT_SESSION]
    );

    const recent = await db.query(
      `SELECT p.reference, p.fee_type, p.amount, p.status, p.created_at, s.full_name, s.matric_number
       FROM payments p JOIN students s ON s.id = p.student_id
       ORDER BY p.created_at DESC LIMIT 8`
    );

    const t = totals.rows[0];
    res.json({
      session: CURRENT_SESSION,
      total_students: students.rows[0].n,
      collected_naira: Number(t.collected) / 100,
      school_collected_naira: Number(t.school_collected) / 100,
      hostel_collected_naira: Number(t.hostel_collected) / 100,
      successful_payments: t.successful,
      pending_payments: t.pending,
      failed_payments: t.failed,
      recent_payments: recent.rows.map((r) => ({ ...r, amount_naira: Number(r.amount) / 100 })),
    });
  })
);

router.get(
  "/students",
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT s.id, s.full_name, s.email, s.matric_number, s.level, s.created_at,
              fs.school_fee, fs.hostel_fee,
              COALESCE(SUM(p.amount) FILTER (WHERE p.fee_type = 'school' AND p.status = 'success'), 0) AS school_paid,
              COALESCE(SUM(p.amount) FILTER (WHERE p.fee_type = 'hostel' AND p.status = 'success'), 0) AS hostel_paid
       FROM students s
       LEFT JOIN fee_structures fs ON fs.level = s.level AND fs.session = $1
       LEFT JOIN payments p ON p.student_id = s.id AND p.session = $1
       WHERE s.full_name ILIKE $2 OR s.matric_number ILIKE $2 OR s.email ILIKE $2
       GROUP BY s.id, fs.school_fee, fs.hostel_fee
       ORDER BY s.full_name
       LIMIT 200`,
      [CURRENT_SESSION, likePattern(req.query.q)]
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        email: r.email,
        matric_number: r.matric_number,
        level: r.level,
        created_at: r.created_at,
        school: r.school_fee == null ? null : buildFee(Number(r.school_fee), Number(r.school_paid)),
        hostel: r.hostel_fee == null ? null : buildFee(Number(r.hostel_fee), Number(r.hostel_paid)),
      }))
    );
  })
);

router.get(
  "/payments",
  asyncHandler(async (req, res) => {
    const status = ["pending", "success", "failed"].includes(req.query.status) ? req.query.status : null;

    const { rows } = await db.query(
      `SELECT p.reference, p.fee_type, p.session, p.amount, p.status, p.channel, p.created_at, p.verified_at,
              s.full_name, s.matric_number, s.level
       FROM payments p JOIN students s ON s.id = p.student_id
       WHERE ($1::text IS NULL OR p.status = $1)
         AND (s.full_name ILIKE $2 OR s.matric_number ILIKE $2 OR p.reference ILIKE $2)
       ORDER BY p.created_at DESC
       LIMIT 300`,
      [status, likePattern(req.query.q)]
    );

    res.json(rows.map((r) => ({ ...r, amount_naira: Number(r.amount) / 100 })));
  })
);

module.exports = router;
