import { ApiResponse } from "../utils/ApiResponse.js";

export function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 100, message = "Too many requests. Please try again later." }) {
  const hits = new Map();

  // Periodically clean up stale entries to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, Math.max(windowMs, 60000)).unref();

  return (req, res, next) => {
    // Derive client IP (respecting proxy headers if behind Netlify/Nginx)
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (forwarded ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress) || "unknown-ip";
    const now = Date.now();

    let record = hits.get(ip);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(ip, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", remaining);
    res.setHeader("RateLimit-Reset", retryAfterSec);

    if (record.count > max) {
      res.setHeader("Retry-After", retryAfterSec);
      return ApiResponse.error(res, message, 429);
    }

    next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts
  message: "Too many authentication attempts. Please try again in 15 minutes.",
});

export const orderRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // 30 order requests
  message: "Order submission rate limit exceeded. Please wait a few moments before trying again.",
});

export const generalRateLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 200,
  message: "Too many requests. Please slow down.",
});
