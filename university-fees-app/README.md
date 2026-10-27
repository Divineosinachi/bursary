# University Fees Portal

Student, staff and admin portals for paying school fees and hostel fees online via
Paystack. The database is hosted on **Supabase** (Postgres), so nothing needs to run
on your laptop except the Node server — no XAMPP, no local database.

See [PORTALS.md](PORTALS.md) for the full list of portals and pages.

## What's included

- Node.js + Express backend
- Supabase (hosted Postgres) database
- Three portals: student, staff, admin — each with its own login and pages
- Student registration and login (JWT sessions, bcrypt-hashed passwords)
- Student-editable contact and origin details on the profile page
- Fee tracking per level/session (school fee and hostel fee tracked separately); students
  can choose any academic session with a fee schedule configured for their level
- Printable school and hostel fee invoices that students can save as PDF
- Paystack payments: initialize → redirect → verify, plus a webhook so payments are
  recorded even if a student closes their browser mid-payment
- Remita school-fee payments: generate an RRR for a selected academic session, open
  Remita to pay, then verify the RRR from the dashboard or payment history
- Printable receipts, change-password, and an admin audit log
- Email password reset links for students, staff, and administrators
- Plain HTML/CSS/JS frontend — no build step

## 1. Create the Supabase database

1. Create a free project at [supabase.com](https://supabase.com). Save the **database
   password** you choose.
2. In the project, click **Connect** and copy the **Session pooler** connection string.
   (Use the pooler string, not "Direct connection" — direct often fails on home networks.)
3. If your password contains special characters (`@ : / # ?` etc.), URL-encode them
   in the connection string, e.g. `@` becomes `%40`.

## 2. Install and configure

You need [Node.js 18+](https://nodejs.org).

```bash
npm install
cp .env.example .env      # on Windows PowerShell: Copy-Item .env.example .env
```

Open `.env` and fill in:

- `DATABASE_URL` — the Supabase pooler string from step 1
- `JWT_SECRET` — any long random string (e.g. `openssl rand -hex 32`)
- `PAYSTACK_PUBLIC_KEY` / `PAYSTACK_SECRET_KEY` — from your
  [Paystack dashboard](https://dashboard.paystack.com/#/settings/developers). Use the
  **test** keys (`pk_test_…` / `sk_test_…`) until you go live.
- `REMITA_MERCHANT_ID`, `REMITA_SERVICE_TYPE_ID`, and `REMITA_API_KEY` — the Remita
  integration credentials issued for your account. `REMITA_BASE_URL` defaults to the
  Remita demo host; use the production host only after Remita has enabled your live
  integration.
- `APP_BASE_URL` — `http://localhost:3000` locally, or your real domain once deployed
- `CURRENT_SESSION` — the academic session you're billing, e.g. `2025/2026`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `MAIL_FROM` — credentials
  and sender address from your email provider, required for password reset emails.
  Use port `587` for STARTTLS or `465` for implicit TLS. If port 587 times out on
  your network, try `465`. Keep these secrets in `.env` or your host's environment
  settings; never commit them.

## 3. Set up the database

```bash
npm run migrate        # creates the tables in Supabase (safe to re-run)
npm run seed           # sets starting fee amounts per level; edit src/seed.js first
npm run create-admin -- "Your Name" you@school.edu "StrongPass1!"
```

Fee amounts can also be changed later in the Admin portal (**Fee amounts**). Admins can
enter a different academic session there and save a fee schedule for each level; students
can then select sessions that have a schedule for their level. The seed step is just a
convenient starting point. The migration also adds the editable
student contact and origin fields; it is safe to re-run on an existing database.

The password must be at least 8 characters with an uppercase letter, a number and a symbol.
Run `npm run migrate` after updating to create the password-reset token table. Verify
SMTP settings by requesting a reset from a registered account; reset links expire after
30 minutes and can only be used once.

After updating an existing installation with Remita support, run `npm run migrate` to
add the payment-provider columns. Configure Remita's merchant ID, service type ID, API
key, and the correct demo or production base URL in `.env`; keep the API key private.

## 4. Run it

```bash
npm start
```

Open `http://localhost:3000`.

- Register a test student at `/student/register.html`, then pay with one of
  [Paystack's test cards](https://paystack.com/docs/payments/test-payments/)
  (card `4084084084084081`, any future expiry, CVV `408`, PIN `0000`, OTP `123456`).
- Log in to `/admin/login.html` with the admin account from step 3, then create staff
  accounts from **Staff accounts**.

## 5. Set up the Paystack webhook (do this before going live)

Banks can be slow to confirm a payment, and a student might close their browser before
the redirect completes. The webhook makes sure the payment is still recorded.

1. Deploy the app somewhere with a public HTTPS URL.
2. In the Paystack dashboard → **Settings → API Keys & Webhooks**, set the webhook URL to
   `https://your-domain.com/api/payments/webhook`

Paystack can't reach `localhost`, so the webhook only works once the app is deployed.
Locally, the redirect-and-verify step still records payments.

## 6. Deploying

This is a standard Node.js app and runs on Render, Railway, Fly.io, a VPS, or similar.

- Set every `.env` value as an environment variable on the host.
- Because the database is on Supabase, you don't need a persistent disk.
- Switch to your **live** Paystack keys when you're ready to accept real money, and update
  the webhook URL to your live domain.
- Serve over HTTPS (any host above does this by default).

## Security notes

- Row-level security is switched on for every table with no policies, so Supabase's public
  API can't read student data. Only this server can, through `DATABASE_URL`.
- Keep `DATABASE_URL` and `JWT_SECRET` out of git (`.env` is already in `.gitignore`).
- Staff and admin sessions last 8 hours; student sessions last 7 days. A deactivated staff
  account loses access immediately.

## How it's structured

```
database/
  schema.sql          — all tables (also pasteable into Supabase's SQL editor)
src/
  server.js           — app entry point, wires everything together
  config.js           — current session, valid levels, password rules
  db.js               — Supabase/Postgres connection
  migrate.js          — npm run migrate
  seed.js             — npm run seed
  createAdmin.js      — npm run create-admin
  paystackService.js  — talks to the Paystack API
  utils/mailer.js     — sends password-reset emails over SMTP
  middleware/
    authMiddleware.js — login tokens and role checks (student / staff / admin)
  routes/
    authRoutes.js     — register, logins, who-am-I, change password
    feeRoutes.js      — a student's fee balance
    paymentRoutes.js  — start, verify, history, receipt
    webhookRoutes.js  — Paystack's server-to-server confirmation
    staffRoutes.js    — student and payment lists (staff and admin)
    adminRoutes.js    — staff accounts, fee amounts, audit log (admin only)
  utils/              — async error wrapper, audit logger
public/
  index.html          — portal chooser
  student/ staff/ admin/   — the pages for each portal
  forgot-password.html and reset-password.html — shared password reset flow
  css/styles.css
  js/                 — common.js (shared) plus one small script per page type
```

## Notes on scope

This is built for a **single university** with a flat fee schedule per level, which matches
most schools' billing. Per-student variations (scholarships, part-payment plans,
carried-over balances) would extend `fee_structures` and `payments` rather than needing a
rebuild.
