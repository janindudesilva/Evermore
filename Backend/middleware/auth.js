import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { ApiResponse } from "../utils/ApiResponse.js";

async function attachUser(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.userId);
  return user;
}

// Requires a valid token — use for account-only routes (e.g. order history).
export async function protect(req, res, next) {
  try {
    const user = await attachUser(req);
    if (!user) return ApiResponse.error(res, "Not authorized, no valid token", 401);
    req.user = user;
    next();
  } catch (err) {
    return ApiResponse.error(res, "Not authorized, token failed", 401);
  }
}

// Attaches req.user if a valid token is present, but never blocks the request.
// Use this on checkout/order-creation so guests can still proceed.
export async function optionalAuth(req, res, next) {
  try {
    req.user = await attachUser(req);
  } catch (err) {
    req.user = null;
  }
  next();
}

export function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return ApiResponse.error(res, "Admin access required", 403);
  }
  next();
}
