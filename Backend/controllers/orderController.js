import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// POST /api/orders
// Works for both logged-in users (req.user set by optionalAuth) and guests.
// Guests must supply guestInfo { name, email, phone, address, city, postalCode }.
export async function createOrder(req, res) {
  try {
    const { items, guestInfo } = req.body;

    if (!items || items.length === 0) {
      return ApiResponse.error(res, "Order must include at least one item", 400);
    }
    if (!req.user && !guestInfo) {
      return ApiResponse.error(res, "Guest checkout requires guestInfo", 400);
    }

    // Re-price server-side from the DB instead of trusting client-sent prices.
    let subtotal = 0;
    const resolvedItems = [];
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) return ApiResponse.error(res, `Product not found: ${item.productId}`, 404);
      subtotal += product.price * item.qty;
      resolvedItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        size: item.size,
        qty: item.qty,
      });
    }

    const shipping = subtotal > 0 ? 6 : 0;
    const total = subtotal + shipping;

    const order = await Order.create({
      items: resolvedItems,
      subtotal,
      shipping,
      total,
      user: req.user ? req.user._id : null,
      guestInfo: req.user ? null : guestInfo,
    });

    return ApiResponse.success(res, "Order placed", order, 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, 400);
  }
}

// GET /api/orders/mine  (account holders only)
export async function getMyOrders(req, res) {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    return ApiResponse.success(res, "Your orders", orders);
  } catch (err) {
    return ApiResponse.error(res, err.message, 500);
  }
}

// GET /api/orders  (admin only)
export async function getAllOrders(req, res) {
  try {
    const orders = await Order.find().populate("user", "name email").sort({ createdAt: -1 });
    return ApiResponse.success(res, "All orders", orders);
  } catch (err) {
    return ApiResponse.error(res, err.message, 500);
  }
}

// PUT /api/orders/:id/status  (admin only)
export async function updateOrderStatus(req, res) {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return ApiResponse.error(res, "Order not found", 404);
    return ApiResponse.success(res, "Order status updated", order);
  } catch (err) {
    return ApiResponse.error(res, err.message, 400);
  }
}
