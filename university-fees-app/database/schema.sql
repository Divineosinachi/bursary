-- University Fees Portal — Supabase (Postgres) schema.
-- Safe to run more than once. Run it with `npm run migrate`, or paste it into
-- the Supabase dashboard -> SQL Editor and press Run.
--
-- Money is stored in kobo (Naira x 100), as Paystack expects.

CREATE TABLE IF NOT EXISTS students (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  matric_number TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  level         TEXT NOT NULL,
  phone_number  TEXT,
  permanent_address TEXT,
  contact_address TEXT,
  state_of_origin TEXT,
  lga_of_origin TEXT,
  home_town     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS permanent_address TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS contact_address TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS state_of_origin TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS lga_of_origin TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS home_town TEXT;

-- Staff and admins share one table; `role` decides which portal they can enter.
CREATE TABLE IF NOT EXISTS staff_users (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('staff', 'admin')),
  department    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_role  TEXT NOT NULL CHECK (user_role IN ('student', 'staff', 'admin')),
  user_id    INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS fee_structures (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  level      TEXT NOT NULL,
  session    TEXT NOT NULL,
  school_fee BIGINT NOT NULL,   -- kobo
  hostel_fee BIGINT NOT NULL,   -- kobo
  UNIQUE (level, session)
);

CREATE TABLE IF NOT EXISTS payments (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id         INTEGER NOT NULL REFERENCES students(id),
  fee_type           TEXT NOT NULL CHECK (fee_type IN ('school', 'hostel')),
  provider           TEXT NOT NULL DEFAULT 'paystack',
  provider_reference TEXT,
  session            TEXT NOT NULL,
  amount             BIGINT NOT NULL,   -- kobo
  reference          TEXT NOT NULL UNIQUE,
  status             TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  channel            TEXT,
  paystack_reference TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at        TIMESTAMPTZ
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'paystack';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_reference TEXT;

-- Who did what in the staff and admin portals.
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_role TEXT NOT NULL,
  actor_id   INTEGER,
  actor_name TEXT,
  action     TEXT NOT NULL,
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_status  ON payments(status);
CREATE INDEX IF NOT EXISTS idx_audit_created    ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_user
  ON password_reset_tokens(user_role, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_created
  ON password_reset_tokens(created_at);

-- Supabase exposes every table through a public REST API by default.
-- Turning on row-level security with NO policies blocks that API completely.
-- Our Node server connects with the database owner role, which bypasses RLS,
-- so the app keeps working while student data stays private.
ALTER TABLE students       ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
