const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const asyncHandler = require("../utils/asyncHandler");
const { requireRole } = require("../middleware/authMiddleware");
const { initializeTransaction, verifyTransaction } = require("../paystackService");
const { generateRrr, verifyRrr } = require("../remitaService");
const { getFeeStatusForStudent } = require("./feeRoutes");

const router = express.Router();

function generateReference() {
  return `UNIFEE-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

// Start a payment for 'school' or 'hostel' fees.
router.post(
  "/initialize",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const { fee_type, session, provider = "paystack" } = req.body || {};
    if (!["school", "hostel"].includes(fee_type)) {
      return res.status(400).json({ error: "fee_type must be 'school' or 'hostel'." });
    }
    if (!["paystack", "remita"].includes(provider)) {
      return res.status(400).json({ error: "Choose Paystack or Remita." });
    }
    if (provider === "remita" && fee_type !== "school") {
      return res.status(400).json({ error: "Remita is currently available for school fees only." });
    }
    if (typeof session !== "string" || !session.trim()) {
      return res.status(400).json({ error: "Select an academic session." });
    }

    const studentResult = await db.query("SELECT * FROM students WHERE id = $1", [req.studentId]);
    const student = studentResult.rows[0];
    if (!student) return res.status(404).json({ error: "Student not found." });

    const status = await getFeeStatusForStudent(student, session);
    if (status.error) return res.status(404).json(status);

    const feeInfo = status[fee_type];
    if (feeInfo.status === "paid") {
      return res.status(400).json({ error: `Your ${fee_type} fee is already fully paid.` });
    }

    const amountKobo = feeInfo.due_kobo - feeInfo.paid_kobo; // pay the remaining balance
    const reference = generateReference();

    await db.query(
      `INSERT INTO payments (student_id, fee_type, provider, session, amount, reference, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
      [student.id, fee_type, provider, session, amountKobo, reference]
    );

    try {
      if (provider === "remita") {
        const remita = await generateRrr({
          amountNaira: (amountKobo / 100).toFixed(2),
          orderId: reference,
          payerName: student.full_name,
          payerEmail: student.email,
          payerPhone: student.phone_number,
          description: `School fees for ${session}, Level ${student.level}`,
        });
        await db.query(
          "UPDATE payments SET provider_reference = $1 WHERE reference = $2",
          [remita.rrr, reference]
        );
        return res.json({
          provider,
          reference,
          rrr: remita.rrr,
          payment_url: remita.paymentUrl,
          amount_naira: amountKobo / 100,
          session,
        });
      }

      const callbackUrl = `${process.env.APP_BASE_URL}/student/dashboard.html?reference=${reference}&session=${encodeURIComponent(session)}`;
      const paystackData = await initializeTransaction({
        email: student.email,
        amountKobo,
        reference,
        callbackUrl,
        metadata: {
          student_id: student.id,
          matric_number: student.matric_number,
          fee_type,
          session,
        },
      });

      res.json({ authorization_url: paystackData.authorization_url, reference });
    } catch (err) {
      await db.query("UPDATE payments SET status = 'failed' WHERE reference = $1", [reference]);
      res.status(502).json({
        error: provider === "remita"
          ? "Could not generate a Remita RRR. Please try again."
          : "Could not start payment with Paystack. Please try again.",
      });
    }
  })
);

// Called by the frontend right after Paystack redirects back, and safe to
// call repeatedly — it always re-checks the real status with Paystack.
router.get(
  "/verify/:reference",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const { reference } = req.params;

    const { rows } = await db.query(
      "SELECT * FROM payments WHERE reference = $1 AND student_id = $2",
      [reference, req.studentId]
    );
    const payment = rows[0];
    if (!payment) return res.status(404).json({ error: "Payment not found." });

    if (payment.status === "success") {
      return res.json({
        status: "success",
        fee_type: payment.fee_type,
        provider: payment.provider,
        rrr: payment.provider_reference,
      });
    }

    try {
      if (payment.provider === "remita") {
        if (!payment.provider_reference) {
          return res.status(409).json({ error: "This payment does not have a Remita RRR yet." });
        }
        const result = await verifyRrr(payment.provider_reference);
        const amountMatches = result.amountNaira == null ||
          Math.round(result.amountNaira * 100) === Number(payment.amount);
        const rrrMatches = result.rrr == null || String(result.rrr) === payment.provider_reference;
        if (result.status === "success" && amountMatches && rrrMatches) {
          await db.query(
            `UPDATE payments
             SET status = 'success', channel = $1, verified_at = now()
             WHERE reference = $2 AND status != 'success'`,
            [result.channel || "Remita", reference]
          );
        } else if (result.status === "success") {
          return res.status(502).json({ error: "Remita confirmed a payment, but its details do not match this fee." });
        }
        return res.json({
          status: result.status,
          fee_type: payment.fee_type,
          provider: payment.provider,
          rrr: payment.provider_reference,
          message: result.message,
        });
      }

      const result = await verifyTransaction(reference);
      const newStatus = result.status === "success" ? "success" : "failed";

      await db.query(
        `UPDATE payments
         SET status = $1, channel = $2, paystack_reference = $3, verified_at = now()
         WHERE reference = $4`,
        [newStatus, result.channel || null, String(result.id || ""), reference]
      );

      res.json({ status: newStatus, fee_type: payment.fee_type, provider: payment.provider });
    } catch (err) {
      res.status(502).json({
        error: payment.provider === "remita"
          ? "Could not confirm payment status with Remita."
          : "Could not confirm payment status with Paystack.",
      });
    }
  })
);

router.get(
  "/history",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT fee_type, provider, provider_reference, session, amount, status, channel, reference, created_at, verified_at
       FROM payments WHERE student_id = $1 ORDER BY created_at DESC`,
      [req.studentId]
    );
    res.json(rows.map((r) => ({ ...r, amount_naira: Number(r.amount) / 100 })));
  })
);

// Data for the printable receipt page. Only successful payments have receipts.
router.get(
  "/receipt/:reference",
  requireRole("student"),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT p.reference, p.fee_type, p.session, p.amount, p.channel, p.verified_at, p.created_at,
              s.full_name, s.matric_number, s.level, s.email
       FROM payments p JOIN students s ON s.id = p.student_id
       WHERE p.reference = $1 AND p.student_id = $2 AND p.status = 'success'`,
      [req.params.reference, req.studentId]
    );
    const r = rows[0];
    if (!r) return res.status(404).json({ error: "No successful payment found with that reference." });

    res.json({ ...r, amount_naira: Number(r.amount) / 100 });
  })
);

module.exports = router;
