const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

// Paystack calls this directly, server-to-server, so a payment still gets
// recorded correctly even if the student closes their browser mid-flow.
// Configure this URL in the Paystack dashboard under Settings > API Keys & Webhooks,
// as: https://your-domain.com/api/payments/webhook
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(async (req, res) => {
    const signature = req.headers["x-paystack-signature"];
    const expected = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY || "")
      .update(req.body)
      .digest("hex");

    if (signature !== expected) {
      return res.status(401).send("Invalid signature");
    }

    const event = JSON.parse(req.body.toString("utf8"));

    if (event.event === "charge.success") {
      await db.query(
        `UPDATE payments
         SET status = 'success', channel = $1, paystack_reference = $2, verified_at = now()
         WHERE reference = $3 AND status != 'success'`,
        [event.data.channel || null, String(event.data.id || ""), event.data.reference]
      );
    }

    res.sendStatus(200);
  })
);

module.exports = router;
