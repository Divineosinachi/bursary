const db = require("../db");

// Records an action taken in the staff/admin portals. Never throws — a failed
// log write must not break the action it describes.
async function logAction(actor, action, details = null) {
  try {
    await db.query(
      `INSERT INTO audit_logs (actor_role, actor_id, actor_name, action, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [actor.role, actor.id || null, actor.name || null, action, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error("Could not write audit log:", err.message);
  }
}

module.exports = { logAction };
