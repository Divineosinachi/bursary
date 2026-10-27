const jwt = require("jsonwebtoken");
const db = require("../db");

// Students stay logged in for a week; staff/admin sessions are shorter.
const TOKEN_LIFETIME = { student: "7d", staff: "8h", admin: "8h" };

function signToken({ id, role }) {
  return jwt.sign({ sub: id, role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_LIFETIME[role] || "8h",
  });
}

/**
 * Protects a route so only the listed roles can use it.
 *   requireRole("student")
 *   requireRole("staff", "admin")
 * On success sets req.user = { id, role, name }.
 */
function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "Not logged in." });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Your session has expired. Please log in again." });
    }

    if (!allowedRoles.includes(payload.role)) {
      return res.status(403).json({ error: "You do not have access to this area." });
    }

    try {
      if (payload.role === "student") {
        const { rows } = await db.query("SELECT id, full_name FROM students WHERE id = $1", [payload.sub]);
        if (!rows[0]) return res.status(401).json({ error: "Account no longer exists. Please log in again." });
        req.user = { id: rows[0].id, role: "student", name: rows[0].full_name };
        req.studentId = rows[0].id;
      } else {
        // Staff/admin: re-check on every request so a deactivated account loses access immediately.
        const { rows } = await db.query(
          "SELECT id, full_name, role, is_active FROM staff_users WHERE id = $1",
          [payload.sub]
        );
        const user = rows[0];
        if (!user || !user.is_active || user.role !== payload.role) {
          return res.status(401).json({ error: "This account is no longer active. Please log in again." });
        }
        req.user = { id: user.id, role: user.role, name: user.full_name };
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { signToken, requireRole };
