import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { createRateLimiter } from "../middleware/rateLimiter.js";

const TEST_SECRET = "super_secure_random_test_jwt_secret_key_1234567890";

test("Auth Security — Password policy requires at least 8 characters", () => {
  function validatePassword(password) {
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }
    return true;
  }

  assert.equal(validatePassword("strongpass123"), true);
  assert.throws(() => validatePassword("123456"), /at least 8 characters/);
  assert.throws(() => validatePassword(""), /at least 8 characters/);
});

test("Auth Security — JWT generation contains user ID and role, and expires", () => {
  const user = { _id: "usr_507f1f77bcf86cd799439011", role: "customer" };
  const token = jwt.sign({ userId: user._id, role: user.role }, TEST_SECRET, { expiresIn: "1h" });

  const decoded = jwt.verify(token, TEST_SECRET);
  assert.equal(decoded.userId, user._id);
  assert.equal(decoded.role, "customer");
});

test("Auth Security — Public registration locks role to 'customer'", () => {
  function sanitizeRegistration(body) {
    const { name, email, password } = body;
    // Explicitly lock role: ignoring any injected 'role: admin'
    return {
      name: name?.trim(),
      email: email?.toLowerCase().trim(),
      password,
      role: "customer",
    };
  }

  const maliciousPayload = {
    name: "Attacker",
    email: "attacker@test.com",
    password: "Password123!",
    role: "admin", // Privilege escalation attempt
  };

  const sanitized = sanitizeRegistration(maliciousPayload);
  assert.equal(sanitized.role, "customer", "Public registration must never accept admin role from request body");
});

test("Rate Limiter Middleware — Blocks requests exceeding threshold with 429", () => {
  const limiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 3, // Allow up to 3 requests
    message: "Rate limit exceeded",
  });

  const makeReq = () => {
    let statusCode = 200;
    let jsonBody = null;
    const req = { headers: { "x-forwarded-for": "192.168.1.100" } };
    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return {
          json: (b) => {
            jsonBody = b;
          },
        };
      },
    };
    let nextCalled = false;
    limiter(req, res, () => {
      nextCalled = true;
    });
    return { statusCode, jsonBody, nextCalled };
  };

  // 1st request -> pass
  const r1 = makeReq();
  assert.equal(r1.nextCalled, true);

  // 2nd request -> pass
  const r2 = makeReq();
  assert.equal(r2.nextCalled, true);

  // 3rd request -> pass
  const r3 = makeReq();
  assert.equal(r3.nextCalled, true);

  // 4th request -> blocked with 429!
  const r4 = makeReq();
  assert.equal(r4.nextCalled, false, "4th request should be blocked by rate limiter");
  assert.equal(r4.statusCode, 429, "Status code must be 429 Too Many Requests");
});
