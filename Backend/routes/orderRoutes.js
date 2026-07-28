import { Router } from "express";
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { protect, optionalAuth, adminOnly } from "../middleware/auth.js";

const router = Router();

// optionalAuth: attaches req.user if a token is present, but doesn't require one —
// this is what lets the same endpoint serve both guest and account checkout.
router.post("/", optionalAuth, createOrder);

router.get("/mine", protect, getMyOrders);
router.get("/", protect, adminOnly, getAllOrders);
router.put("/:id/status", protect, adminOnly, updateOrderStatus);

export default router;
