import { ApiResponse } from "../utils/ApiResponse.js";

export function notFound(req, res) {
  return ApiResponse.error(res, `Route not found: ${req.originalUrl}`, 404);
}

export function errorHandler(err, req, res, next) {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  return ApiResponse.error(res, err.message || "Server error", statusCode);
}
