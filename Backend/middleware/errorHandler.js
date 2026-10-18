import { ApiResponse } from "../utils/ApiResponse.js";

export function notFound(req, res) {
  return ApiResponse.error(res, `Route not found: ${req.originalUrl}`, 404);
}

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  // In production, do not leak internal database errors or stack traces
  let userMessage = err.message || "An unexpected server error occurred.";
  if (statusCode === 500 && process.env.NODE_ENV === "production") {
    userMessage = "Internal server error. Please try again later.";
  }

  return ApiResponse.error(res, userMessage, statusCode);
}
