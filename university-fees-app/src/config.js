// Settings shared across the backend.
const CURRENT_SESSION = process.env.CURRENT_SESSION || "2025/2026";
const VALID_LEVELS = ["100", "200", "300", "400", "500"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;
const PASSWORD_RULE_MESSAGE =
  "Password must be at least 8 characters and include an uppercase letter, a number, and a symbol.";

module.exports = {
  CURRENT_SESSION,
  VALID_LEVELS,
  EMAIL_REGEX,
  PASSWORD_REGEX,
  PASSWORD_RULE_MESSAGE,
};
