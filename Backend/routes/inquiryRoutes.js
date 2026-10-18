import { Router } from "express";
import { submitContact, submitNewsletter } from "../controllers/inquiryController.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

const inquiryLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many messages submitted. Please try again later.",
});

router.post("/contact", inquiryLimiter, submitContact);
router.post("/newsletter", inquiryLimiter, submitNewsletter);

export default router;
