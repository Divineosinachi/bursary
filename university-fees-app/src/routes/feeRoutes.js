const express = require("express");
const db = require("../db");
const asyncHandler = require("../utils/asyncHandler");
const { requireRole } = require("../middleware/authMiddleware");
const { CURRENT_SESSION } = require("../config");

const router = express.Router();

function buildFee(due, paid) {
  return {
    due_kobo: due,
    due_naira: due / 100,
    paid_kobo: paid,
    paid_naira: paid / 100,
    balance_naira: Math.max(0, due - paid) / 100,
    status: paid >= due ? "paid" : paid > 0 ? "partial" : "unpaid",
  };
}

async function getFeeStatusForStudent(student, session = CURRENT_SESSION) {
  const structureResult = await db.query(
    "SELECT school_fee, hostel_fee FROM fee_structures WHERE level = $1 AND session = $2",
    [student.level, session]
  );
  const structure = structureResult.rows[0];

  if (!structure) {
    return { error: `No fee structure has been set up for level ${student.level} in session ${session}.` };
  }

  const paidResult = await db.query(
    `SELECT fee_type, COALESCE(SUM(amount), 0) AS paid
     FROM payments
     WHERE student_id = $1 AND session = $2 AND status = 'success'
     GROUP BY fee_type`,
    [student.id, session]
  );

  const paidMap = { school: 0, hostel: 0 };
  for (const row of paidResult.rows) paidMap[row.fee_type] = Number(row.paid);

  return {
    session,
    level: student.level,
    school: buildFee(Number(structure.school_fee), paidMap.school),
    hostel: buildFee(Number(structure.hostel_fee), paidMap.hostel),
  };
}

router.get(
  "/sessions",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const { rows: studentRows } = await db.query(
      "SELECT level FROM students WHERE id = $1",
      [req.studentId]
    );
    const student = studentRows[0];
    if (!student) return res.status(404).json({ error: "Student not found." });

    const { rows } = await db.query(
      "SELECT DISTINCT session FROM fee_structures WHERE level = $1 ORDER BY session DESC",
      [student.level]
    );
    res.json({
      current_session: CURRENT_SESSION,
      sessions: rows.map((row) => row.session),
    });
  })
);

router.get(
  "/me",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query("SELECT * FROM students WHERE id = $1", [req.studentId]);
    const student = rows[0];
    if (!student) return res.status(404).json({ error: "Student not found." });

    const session = typeof req.query.session === "string" ? req.query.session : CURRENT_SESSION;
    const status = await getFeeStatusForStudent(student, session);
    if (status.error) return res.status(404).json(status);

    res.json({
      student: {
        full_name: student.full_name,
        email: student.email,
        matric_number: student.matric_number,
        level: student.level,
      },
      fees: status,
    });
  })
);

module.exports = { router, getFeeStatusForStudent, buildFee, CURRENT_SESSION };
