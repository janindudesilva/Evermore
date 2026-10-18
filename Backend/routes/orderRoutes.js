import { Router } from "express";
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelMyOrder,
  recordOrderPayment,
} from "../controllers/orderController.js";
import { protect, optionalAuth, adminOnly } from "../middleware/auth.js";
import { orderRateLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Order creation with rate limiting and optional authentication
router.post("/", orderRateLimiter, optionalAuth, createOrder);

// Account holder orders and cancellation
router.get("/mine", protect, getMyOrders);
router.post("/:id/cancel", protect, cancelMyOrder);
router.get("/:id", protect, getOrderById);

// Admin endpoints
router.get("/", protect, adminOnly, getAllOrders);
router.put("/:id/status", protect, adminOnly, updateOrderStatus);
router.put("/:id/payment", protect, adminOnly, recordOrderPayment);

export default router;
