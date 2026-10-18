import { Router } from "express";
import {
  submitContact,
  submitNewsletter,
  unsubscribeNewsletter,
  getInquiries,
  updateInquiryStatus,
} from "../controllers/inquiryController.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { protect, adminOnly } from "../middleware/auth.js";

const router = Router();

const inquiryLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many requests submitted. Please try again later.",
});

// Public endpoints with rate limiting
router.post("/contact", inquiryLimiter, submitContact);
router.post("/newsletter", inquiryLimiter, submitNewsletter);
router.post("/newsletter/unsubscribe", inquiryLimiter, unsubscribeNewsletter);

// Admin review endpoints
router.get("/", protect, adminOnly, getInquiries);
router.put("/:id/status", protect, adminOnly, updateInquiryStatus);

export default router;
