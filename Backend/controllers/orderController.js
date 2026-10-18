import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const ALLOWED_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

// Helper: rollback deducted stock on failure
async function rollbackStock(deductions) {
  for (const d of deductions) {
    try {
      await Product.updateOne(
        { _id: d.productId },
        { $inc: { [`stock.${d.size}`]: d.qty } }
      );
    } catch (err) {
      console.error(`Failed to rollback stock for product ${d.productId}, size ${d.size}:`, err);
    }
  }
}

// POST /api/orders
export async function createOrder(req, res) {
  const deductedItems = [];

  try {
    const { items, customer, shippingAddress, guestInfo, paymentMethod = "cod", idempotencyKey } = req.body;

    // Check for idempotency key
    const idempKey = idempotencyKey || req.headers["idempotency-key"];
    if (idempKey) {
      const existing = await Order.findOne({ idempotencyKey: idempKey });
      if (existing) {
        return ApiResponse.success(res, "Order retrieved (idempotent)", existing, 200);
      }
    }

    // 1. Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponse.error(res, "Order must include at least one item", 400);
    }

    // Consolidate duplicate items in the request for the same (productId, size)
    const itemMap = new Map();
    for (const rawItem of items) {
      if (!rawItem.productId || !mongoose.Types.ObjectId.isValid(rawItem.productId)) {
        return ApiResponse.error(res, `Invalid product ID: ${rawItem.productId}`, 400);
      }
      if (!rawItem.size || typeof rawItem.size !== "string") {
        return ApiResponse.error(res, "A valid size must be specified for each item", 400);
      }
      const qty = Number(rawItem.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
        return ApiResponse.error(res, "Invalid quantity: must be an integer between 1 and 50", 400);
      }

      const key = `${rawItem.productId}_${rawItem.size}`;
      if (itemMap.has(key)) {
        const existing = itemMap.get(key);
        const mergedQty = existing.qty + qty;
        if (mergedQty > 50) {
          return ApiResponse.error(res, "Total quantity for a single garment variant cannot exceed 50", 400);
        }
        existing.qty = mergedQty;
      } else {
        itemMap.set(key, { productId: rawItem.productId, size: rawItem.size, qty });
      }
    }

    const consolidatedItems = Array.from(itemMap.values());
    if (consolidatedItems.length > 50) {
      return ApiResponse.error(res, "Orders cannot contain more than 50 distinct items", 400);
    }

    // 2. Validate customer & shipping address snapshots
    let resolvedCustomer = customer;
    let resolvedShipping = shippingAddress;

    // Backward-compatibility: support guestInfo object if passed
    if (!resolvedCustomer && guestInfo) {
      resolvedCustomer = {
        name: guestInfo.name,
        email: guestInfo.email,
        phone: guestInfo.phone,
      };
    }
    if (!resolvedShipping && guestInfo) {
      resolvedShipping = {
        address: guestInfo.address,
        city: guestInfo.city,
        postalCode: guestInfo.postalCode,
        country: guestInfo.country || "Sri Lanka",
      };
    }

    // If logged-in user and customer info partially missing, pull from user record
    if (req.user) {
      if (!resolvedCustomer) {
        resolvedCustomer = {
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone || "",
        };
      } else {
        resolvedCustomer.email = resolvedCustomer.email || req.user.email;
        resolvedCustomer.name = resolvedCustomer.name || req.user.name;
      }
    }

    // Validate customer fields
    if (!resolvedCustomer?.name || resolvedCustomer.name.trim().length < 2) {
      return ApiResponse.error(res, "Customer full name is required", 400);
    }
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!resolvedCustomer?.email || !emailRegex.test(resolvedCustomer.email)) {
      return ApiResponse.error(res, "A valid customer email address is required", 400);
    }
    if (!resolvedCustomer?.phone || resolvedCustomer.phone.trim().length < 5) {
      return ApiResponse.error(res, "Customer contact phone number is required", 400);
    }

    // Validate shipping address fields
    if (!resolvedShipping?.address || resolvedShipping.address.trim().length < 3) {
      return ApiResponse.error(res, "Delivery address is required", 400);
    }
    if (!resolvedShipping?.city || resolvedShipping.city.trim().length < 2) {
      return ApiResponse.error(res, "City is required", 400);
    }
    if (!resolvedShipping?.postalCode || resolvedShipping.postalCode.trim().length < 2) {
      return ApiResponse.error(res, "Postal code is required", 400);
    }

    // 3. Validate each item and atomically reserve/deduct inventory
    let subtotal = 0;
    const resolvedItems = [];

    for (const item of consolidatedItems) {
      // Check product in database
      const product = await Product.findOne({ _id: item.productId, isActive: true });
      if (!product) {
        await rollbackStock(deductedItems);
        return ApiResponse.error(res, `Product not found or inactive: ${item.productId}`, 404);
      }

      // Validate size is allowed
      if (!product.sizes.includes(item.size)) {
        await rollbackStock(deductedItems);
        return ApiResponse.error(
          res,
          `Size '${item.size}' is not available for product '${product.name}'`,
          400
        );
      }

      // Check and atomically decrement variant stock if product has stock map
      const currentStockForSize = product.getStockForSize(item.size);
      if (currentStockForSize < item.qty) {
        await rollbackStock(deductedItems);
        return ApiResponse.error(
          res,
          `Insufficient stock for '${product.name}' in size '${item.size}'. Only ${currentStockForSize} available.`,
          400
        );
      }

      // Atomic conditional decrement to prevent race conditions & overselling
      const stockField = `stock.${item.size}`;
      const decrementResult = await Product.updateOne(
        {
          _id: product._id,
          isActive: true,
          [stockField]: { $gte: item.qty },
        },
        {
          $inc: { [stockField]: -item.qty },
        }
      );

      if (decrementResult.modifiedCount === 0) {
        // Concurrency conflict: someone else purchased the stock between read and write
        await rollbackStock(deductedItems);
        return ApiResponse.error(
          res,
          `Sorry, '${product.name}' in size '${item.size}' just sold out. Please review your cart.`,
          409
        );
      }

      deductedItems.push({ productId: product._id, size: item.size, qty: item.qty });

      const itemTotal = product.price * item.qty;
      subtotal = Math.round((subtotal + itemTotal) * 100) / 100;

      resolvedItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        size: item.size,
        color: product.color || "",
        qty: item.qty,
      });
    }

    // 4. Calculate shipping: flat $6, or free over $150
    const shipping = subtotal >= 150 || subtotal === 0 ? 0 : 6;
    const total = Math.round((subtotal + shipping) * 100) / 100;

    // 5. Determine payment status based on method
    const validPaymentMethods = ["cod", "card", "test"];
    const chosenMethod = validPaymentMethods.includes(paymentMethod) ? paymentMethod : "cod";
    const paymentStatus = "pending";

    // 6. Persist order
    const orderData = {
      items: resolvedItems,
      subtotal,
      shipping,
      total,
      status: "pending",
      paymentMethod: chosenMethod,
      paymentStatus,
      customer: resolvedCustomer,
      shippingAddress: resolvedShipping,
      user: req.user ? req.user._id : null,
    };

    if (idempKey) {
      orderData.idempotencyKey = idempKey;
    }

    let order;
    try {
      order = await Order.create(orderData);
    } catch (createErr) {
      // Handle concurrent race condition on idempotencyKey unique constraint (MongoDB error 11000)
      if (createErr.code === 11000 && idempKey) {
        await rollbackStock(deductedItems);
        const existingOrder = await Order.findOne({ idempotencyKey: idempKey });
        if (existingOrder) {
          return ApiResponse.success(res, "Order retrieved (idempotent)", existingOrder, 200);
        }
      }
      throw createErr;
    }

    return ApiResponse.success(res, "Order placed successfully", order, 201);
  } catch (err) {
    // In case of any unhandled error during creation, roll back deducted inventory
    await rollbackStock(deductedItems);
    console.error("Order creation error:", err);
    return ApiResponse.error(res, err.message || "Failed to create order", 400);
  }
}

// GET /api/orders/mine (authenticated user)
export async function getMyOrders(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const total = await Order.countDocuments({ user: req.user._id });
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.success(res, "Your orders", {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    return ApiResponse.error(res, "Could not fetch orders", 500);
  }
}

// GET /api/orders (admin only)
export async function getAllOrders(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return ApiResponse.success(res, "All orders", {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    return ApiResponse.error(res, "Could not fetch orders", 500);
  }
}

// GET /api/orders/:id (authenticated customer or admin)
export async function getOrderById(req, res) {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return ApiResponse.error(res, "Order not found", 404);

    // Verify ownership if not admin
    if (req.user.role !== "admin" && String(order.user) !== String(req.user._id)) {
      return ApiResponse.error(res, "Not authorized to view this order", 403);
    }

    return ApiResponse.success(res, "Order details", order);
  } catch (err) {
    return ApiResponse.error(res, "Order not found", 404);
  }
}

// PUT /api/orders/:id/status (admin only)
export async function updateOrderStatus(req, res) {
  try {
    const { status, note = "" } = req.body;
    if (!status) return ApiResponse.error(res, "Status is required", 400);

    const order = await Order.findById(req.params.id);
    if (!order) return ApiResponse.error(res, "Order not found", 404);

    const currentStatus = order.status;
    if (currentStatus === status) {
      return ApiResponse.success(res, "Order already has this status", order);
    }

    // Check allowed state transition
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(status)) {
      return ApiResponse.error(
        res,
        `Cannot transition order from '${currentStatus}' to '${status}'. Allowed transitions: ${allowed.join(", ") || "none"}`,
        400
      );
    }

    // Atomically transition the status to prevent duplicate transition race condition
    const updateFields = {
      status,
      $push: {
        statusHistory: {
          status,
          timestamp: new Date(),
          note: note || `Status updated to ${status} by admin`,
        },
      },
    };

    if (status === "delivered" && order.paymentMethod === "cod" && order.paymentStatus === "pending") {
      updateFields.paymentStatus = "paid";
    }

    if (status === "cancelled") {
      updateFields.paymentStatus = order.paymentStatus === "paid" ? "refunded" : "cancelled";
    }

    // Atomic conditional status transition
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: req.params.id, status: currentStatus },
      updateFields,
      { returnDocument: "after", runValidators: true }
    );

    if (!updatedOrder) {
      return ApiResponse.error(res, "Order status was modified by another operation. Please reload.", 409);
    }

    // If successfully transitioned to cancelled, restore variant inventory exactly once
    if (status === "cancelled" && currentStatus !== "cancelled") {
      for (const item of updatedOrder.items) {
        try {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { [`stock.${item.size}`]: item.qty } }
          );
        } catch (err) {
          console.error(`Failed to restore stock for product ${item.product}:`, err);
        }
      }
    }

    return ApiResponse.success(res, "Order status updated", updatedOrder);
  } catch (err) {
    return ApiResponse.error(res, err.message || "Failed to update order status", 400);
  }
}

// POST /api/orders/:id/cancel (customer self-cancellation for pending orders)
export async function cancelMyOrder(req, res) {
  try {
    // Atomically find and cancel order ONLY if it is still in 'pending' status
    // This prevents race condition and double stock restoration on concurrent cancellation requests
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, status: "pending" },
      {
        $set: { status: "cancelled", paymentStatus: "cancelled" },
        $push: {
          statusHistory: {
            status: "cancelled",
            timestamp: new Date(),
            note: "Cancelled by customer",
          },
        },
      },
      { returnDocument: "after" }
    );

    if (!updatedOrder) {
      // Check whether order didn't exist, belonged to another user, or was already transitioned
      const existing = await Order.findById(req.params.id);
      if (!existing) {
        return ApiResponse.error(res, "Order not found", 404);
      }
      if (String(existing.user) !== String(req.user._id)) {
        return ApiResponse.error(res, "Not authorized to cancel this order", 403);
      }
      return ApiResponse.error(
        res,
        `Cannot cancel order with status '${existing.status}'. Only pending orders can be cancelled.`,
        400
      );
    }

    // Restore stock exactly once since atomic update succeeded
    for (const item of updatedOrder.items) {
      try {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { [`stock.${item.size}`]: item.qty } }
        );
      } catch (err) {
        console.error(`Stock restoration failed for product ${item.product}:`, err);
      }
    }

    return ApiResponse.success(res, "Order cancelled and stock restored", updatedOrder);
  } catch (err) {
    return ApiResponse.error(res, err.message || "Failed to cancel order", 400);
  }
}
