require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const { router: feeRoutes } = require("./routes/feeRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const staffRoutes = require("./routes/staffRoutes");
const adminRoutes = require("./routes/adminRoutes");

for (const required of [
  "JWT_SECRET",
  "DATABASE_URL",
  "PAYSTACK_SECRET_KEY",
  "PAYSTACK_PUBLIC_KEY",
  "APP_BASE_URL",
]) {
  if (!process.env[required]) {
    console.warn(`Warning: ${required} is not set in .env — the app will not work correctly until it is.`);
  }
}

if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER ||
    !process.env.SMTP_PASS || !process.env.MAIL_FROM) {
  console.warn("Warning: SMTP is not configured — password reset emails will be unavailable.");
}

const app = express();
app.use(cors());

// Webhook needs the raw body for signature verification, so it must be
// mounted before the JSON body parser below.
app.use("/api/payments", webhookRoutes);

app.use(express.json());

app.get("/api/config", (req, res) => {
  res.json({ paystack_public_key: process.env.PAYSTACK_PUBLIC_KEY || "" });
});

// Shared login / registration / change-password
app.use("/api/auth", authRoutes);

// Student portal API
app.use("/api/fees", feeRoutes);
app.use("/api/payments", paymentRoutes);

// Staff portal API (admins can use it too)
app.use("/api/staff", staffRoutes);

// Admin portal API
app.use("/api/admin", adminRoutes);

app.use(express.static(path.join(__dirname, "..", "public")));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our end. Please try again." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`University fees portal running at ${process.env.APP_BASE_URL || `http://localhost:${PORT}`}`);
});
