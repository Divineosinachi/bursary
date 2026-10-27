// Express 4 doesn't catch errors thrown inside async route handlers.
// Wrapping a handler with this forwards them to the error middleware
// in server.js instead of crashing the process.
module.exports = function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
};
