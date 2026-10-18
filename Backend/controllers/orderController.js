import crypto from "crypto";
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

// Helper: canonical order payload hash for idempotency integrity verification
export function computeOrderPayloadHash(items, customer, shippingAddress, paymentMethod = "cod") {
  const sortedItems = [...(items || [])]
    .map((i) => ({
      productId: String(i.productId || i.product || ""),
      size: String(i.size || "").trim().toUpperCase(),
      qty: Number(i.qty),
    }))
    .sort((a, b) => {
      const comp = a.productId.localeCompare(b.productId);
      return comp !== 0 ? comp : a.size.localeCompare(b.size);
    });

  const canonical = {
    items: sortedItems,
    customer: {
      email: (customer?.email || "").toLowerCase().trim(),
      name: (customer?.name || "").trim(),
      phone: (customer?.phone || "").trim(),
    },
    shippingAddress: {
      address: (shippingAddress?.address || "").trim(),
      city: (shippingAddress?.city || "").trim(),
      postalCode: (shippingAddress?.postalCode || "").trim(),
    },
    paymentMethod: paymentMethod || "cod",
  };

  return crypto.createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

// Helper: verify that an existing order with the same idempotency key matches identity and payload
export function verifyIdempotencyMatch(existingOrder, reqUser, resolvedCustomer, currentPayloadHash) {
  // 1. Identity association check
  if (existingOrder.user) {
    // Authenticated order: requesting identity must be the exact same authenticated user
    if (!reqUser || String(reqUser._id) !== String(existingOrder.user)) {
      return {
        matched: false,
        status: 403,
        message: "Not authorized: idempotency key is associated with another customer account",
      };
    }
  } else {
    // Guest checkout order: must match guest checkout email and phone
    const existingEmail = (existingOrder.customer?.email || "").toLowerCase().trim();
    const existingPhone = (existingOrder.customer?.phone || "").trim();
    const reqEmail = (resolvedCustomer?.email || "").toLowerCase().trim();
    const reqPhone = (resolvedCustomer?.phone || "").trim();

    if (reqEmail !== existingEmail || (existingPhone && reqPhone && reqPhone !== existingPhone)) {
      return {
        matched: false,
        status: 403,
        message: "Not authorized: idempotency key does not match checkout identity",
      };
    }
  }

  // 2. Order payload match check: reject key reuse with a different order payload
  const existingHash =
    existingOrder.idempotencyPayloadHash ||
    computeOrderPayloadHash(
      existingOrder.items,
      existingOrder.customer,
      existingOrder.shippingAddress,
      existingOrder.paymentMethod
    );

  if (currentPayloadHash !== existingHash) {
    return {
      matched: false,
      status: 400,
      message: "Idempotency key already used with a different order payload",
    };
  }

  return { matched: true };
}

// Helper: rollback deducted stock on failure
async function rollbackStock(deductions) {
  for (const d of deductions) {
    try {
      await Product.updateOne(
        { _id: d.productId },
        { $inc: { [`stock.${d.size}`]: d.qty } }
      );
    } catch (err) {
      console.error(`Failed to rollback stock for product ${d.productId}, size ${d.size}:`, err.message || err);
    }
  }
}

// POST /api/orders
export async function createOrder(req, res) {
  try {
    const { items, customer, shippingAddress, guestInfo, paymentMethod = "cod", idempotencyKey } = req.body;

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

    // Validate payment method: currently EVERMORE exclusively supports Cash on Delivery (COD)
    if (paymentMethod && paymentMethod !== "cod") {
      return ApiResponse.error(
        res,
        `Payment method '${paymentMethod}' is not supported. Cash on Delivery (COD) is currently the only active payment method.`,
        400
      );
    }
    const chosenMethod = "cod";

    const currentPayloadHash = computeOrderPayloadHash(
      consolidatedItems,
      resolvedCustomer,
      resolvedShipping,
      chosenMethod
    );

    // 3. Check for idempotency key AFTER full request validation
    const rawIdempKey = idempotencyKey || req.headers?.["idempotency-key"];
    const idempKey = typeof rawIdempKey === "string" && rawIdempKey.trim() ? rawIdempKey.trim() : null;

    if (idempKey) {
      const existing = await Order.findOne({ idempotencyKey: idempKey });
      if (existing) {
        const verify = verifyIdempotencyMatch(existing, req.user, resolvedCustomer, currentPayloadHash);
        if (!verify.matched) {
          return ApiResponse.error(res, verify.message, verify.status);
        }
        return ApiResponse.success(res, "Order retrieved (idempotent)", existing, 200);
      }
    }

    // 4. ACID Transaction: Execute variant inventory deduction and order persistence atomically
    const session = await mongoose.startSession();
    let createdOrder = null;

    try {
      await session.withTransaction(async () => {
        let subtotal = 0;
        const resolvedItems = [];

        for (const item of consolidatedItems) {
          // Read product inside transaction session
          const product = await Product.findOne({ _id: item.productId, isActive: true }).session(session);
          if (!product) {
            const err = new Error(`Product not found or inactive: ${item.productId}`);
            err.statusCode = 404;
            throw err;
          }

          // Validate size is allowed
          if (!product.sizes.includes(item.size)) {
            const err = new Error(`Size '${item.size}' is not available for product '${product.name}'`);
            err.statusCode = 400;
            throw err;
          }

          // Check stock
          const currentStockForSize = product.getStockForSize(item.size);
          if (currentStockForSize < item.qty) {
            const err = new Error(
              `Insufficient stock for '${product.name}' in size '${item.size}'. Only ${currentStockForSize} available.`
            );
            err.statusCode = 400;
            throw err;
          }

          // Atomic conditional decrement inside the transaction
          const stockField = `stock.${item.size}`;
          const decrementResult = await Product.updateOne(
            {
              _id: product._id,
              isActive: true,
              [stockField]: { $gte: item.qty },
            },
            {
              $inc: { [stockField]: -item.qty },
            },
            { session }
          );

          if (decrementResult.modifiedCount === 0) {
            const err = new Error(
              `Sorry, '${product.name}' in size '${item.size}' just sold out. Please review your cart.`
            );
            err.statusCode = 409;
            throw err;
          }

          const itemTotal = Math.round(product.price * item.qty * 100) / 100;
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

        // Calculate shipping: flat $6, or free over $150
        const shipping = subtotal >= 150 || subtotal === 0 ? 0 : 6;
        const total = Math.round((subtotal + shipping) * 100) / 100;

        const orderData = {
          items: resolvedItems,
          subtotal,
          shipping,
          total,
          currency: "USD",
          status: "pending",
          paymentMethod: "cod",
          paymentStatus: "pending",
          customer: resolvedCustomer,
          shippingAddress: resolvedShipping,
          user: req.user ? req.user._id : null,
          idempotencyPayloadHash: currentPayloadHash,
          inventoryRestored: false,
        };

        if (idempKey) {
          orderData.idempotencyKey = idempKey;
        }

        const created = await Order.create([orderData], { session });
        createdOrder = created[0];
      });
    } catch (txnError) {
      // Check for concurrent idempotency race condition (code 11000)
      if (txnError.code === 11000 && idempKey) {
        const existingOrder = await Order.findOne({ idempotencyKey: idempKey });
        if (existingOrder) {
          const verify = verifyIdempotencyMatch(existingOrder, req.user, resolvedCustomer, currentPayloadHash);
          if (!verify.matched) {
            return ApiResponse.error(res, verify.message, verify.status);
          }
          return ApiResponse.success(res, "Order retrieved (idempotent)", existingOrder, 200);
        }
      }

      // Explicit refusal to silently fall back if deployment doesn't support transactions
      if (
        txnError.code === 20 ||
        txnError.message?.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
        txnError.message?.includes("This MongoDB deployment does not support transactions")
      ) {
        console.error("Transaction error: MongoDB deployment does not support transactions");
        return ApiResponse.error(
          res,
          "Database deployment does not support transactions. A replica set deployment is required to guarantee atomic inventory consistency.",
          500
        );
      }

      const statusCode = txnError.statusCode || 400;
      console.error("Order creation transaction aborted:", txnError.message || "Transaction aborted");
      return ApiResponse.error(res, txnError.message || "Failed to create order", statusCode);
    } finally {
      await session.endSession();
    }

    return ApiResponse.success(res, "Order placed successfully", createdOrder, 201);
  } catch (err) {
    console.error("Order creation error:", err.message || "Failed to create order");
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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return ApiResponse.error(res, "Order not found", 404);
    }

    const order = await Order.findById(req.params.id);
    if (!order) return ApiResponse.error(res, "Order not found", 404);

    // Verify ownership: customer can only view their own order; admin can view all
    if (req.user.role !== "admin" && (!order.user || String(order.user) !== String(req.user._id))) {
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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return ApiResponse.error(res, "Order not found", 404);
    }

    const { status, note = "" } = req.body;
    if (!status) return ApiResponse.error(res, "Status is required", 400);

    const session = await mongoose.startSession();
    let updatedOrder = null;

    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(req.params.id).session(session);
        if (!order) {
          const err = new Error("Order not found");
          err.statusCode = 404;
          throw err;
        }

        const currentStatus = order.status;
        if (currentStatus === status) {
          updatedOrder = order;
          return;
        }

        // Check allowed state transition
        const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(status)) {
          const err = new Error(
            `Cannot transition order from '${currentStatus}' to '${status}'. Allowed transitions: ${allowed.join(", ") || "none"}`
          );
          err.statusCode = 400;
          throw err;
        }

        order.status = status;
        order.statusHistory.push({
          status,
          timestamp: new Date(),
          note: note || `Status updated to ${status} by admin`,
        });

        if (status === "delivered" && order.paymentMethod === "cod" && order.paymentStatus === "pending") {
          order.paymentStatus = "paid";
          order.paymentDetails = {
            collectedAt: new Date(),
            collectedBy: req.user?._id || null,
            amountCollected: order.total,
            note: "COD payment verified and collected upon delivery completion",
          };
          order.paymentHistory.push({
            paymentStatus: "paid",
            timestamp: new Date(),
            actor: req.user?._id || null,
            note: "COD payment collected upon final delivery by admin",
          });
        }

        // Transactionally restore variant inventory if transitioning to cancelled
        if (status === "cancelled") {
          // Do not mark an order refunded unless a real refund workflow supports that status (Task 11)
          if (order.paymentStatus === "pending") {
            order.paymentStatus = "cancelled";
          }

          // Prevent restoring inventory more than once
          if (!order.inventoryRestored) {
            order.inventoryRestored = true;
            for (const item of order.items) {
              const stockField = `stock.${item.size}`;
              await Product.updateOne(
                { _id: item.product },
                { $inc: { [stockField]: item.qty } },
                { session }
              );
            }
          }
        }

        await order.save({ session });
        updatedOrder = order;
      });
    } catch (txnError) {
      if (
        txnError.code === 20 ||
        txnError.message?.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
        txnError.message?.includes("This MongoDB deployment does not support transactions")
      ) {
        return ApiResponse.error(
          res,
          "Database deployment does not support transactions. A replica set deployment is required to guarantee atomic order updates.",
          500
        );
      }

      const statusCode = txnError.statusCode || 400;
      console.error("Order status update transaction aborted:", txnError.message);
      return ApiResponse.error(res, txnError.message || "Failed to update order status", statusCode);
    } finally {
      await session.endSession();
    }

    return ApiResponse.success(res, "Order status updated", updatedOrder);
  } catch (err) {
    return ApiResponse.error(res, err.message || "Failed to update order status", 400);
  }
}

// PUT /api/orders/:id/payment (admin only - manually record collected COD payment)
export async function recordOrderPayment(req, res) {
  try {
    if (!req.user) {
      return ApiResponse.error(res, "Authentication required", 401);
    }
    if (req.user.role !== "admin") {
      return ApiResponse.error(res, "Administrator privileges required to record payment collection", 403);
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return ApiResponse.error(res, "Order not found", 404);
    }

    const { note = "", amount } = req.body || {};

    const session = await mongoose.startSession();
    let updatedOrder = null;

    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(req.params.id).session(session);
        if (!order) {
          const err = new Error("Order not found");
          err.statusCode = 404;
          throw err;
        }

        // Prevent modifying payment on cancelled orders
        if (order.status === "cancelled") {
          const err = new Error("Cannot record payment collection for a cancelled order.");
          err.statusCode = 400;
          throw err;
        }

        // Prevent repeated payment confirmation from recording collection twice (Task 10)
        if (order.paymentStatus === "paid") {
          const err = new Error(
            `Payment of $${order.total} has already been collected and recorded for this order.`
          );
          err.statusCode = 400;
          throw err;
        }

        const collectedAmount =
          amount !== undefined && !isNaN(Number(amount)) && Number(amount) > 0
            ? Math.round(Number(amount) * 100) / 100
            : order.total;

        order.paymentStatus = "paid";
        order.paymentDetails = {
          collectedAt: new Date(),
          collectedBy: req.user._id,
          amountCollected: collectedAmount,
          note: note ? String(note).trim() : "COD payment collection verified by administrator",
        };

        order.paymentHistory.push({
          paymentStatus: "paid",
          timestamp: new Date(),
          actor: req.user._id,
          note: note ? String(note).trim() : `Manual COD payment recorded ($${collectedAmount})`,
        });

        order.statusHistory.push({
          status: order.status,
          timestamp: new Date(),
          note: `Payment marked paid ($${collectedAmount}) by admin: ${note || "verified"}`,
        });

        await order.save({ session });
        updatedOrder = order;
      });
    } catch (txnError) {
      if (
        txnError.code === 20 ||
        txnError.message?.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
        txnError.message?.includes("This MongoDB deployment does not support transactions")
      ) {
        return ApiResponse.error(
          res,
          "Database deployment does not support transactions. A replica set deployment is required to guarantee atomic payment recording.",
          500
        );
      }

      const statusCode = txnError.statusCode || 400;
      return ApiResponse.error(res, txnError.message || "Failed to record payment", statusCode);
    } finally {
      await session.endSession();
    }

    return ApiResponse.success(res, "Payment collection recorded successfully", updatedOrder);
  } catch (err) {
    console.error("Record payment error:", err.message || "Failed to record payment");
    return ApiResponse.error(res, err.message || "Failed to record payment", 400);
  }
}

// POST /api/orders/:id/cancel (customer self-cancellation for pending orders)
export async function cancelMyOrder(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return ApiResponse.error(res, "Order not found", 404);
    }

    const session = await mongoose.startSession();
    let cancelledOrder = null;

    try {
      await session.withTransaction(async () => {
        const order = await Order.findById(req.params.id).session(session);
        if (!order) {
          const err = new Error("Order not found");
          err.statusCode = 404;
          throw err;
        }

        if (!order.user || String(order.user) !== String(req.user._id)) {
          const err = new Error("Not authorized to cancel this order");
          err.statusCode = 403;
          throw err;
        }

        if (order.status !== "pending") {
          const err = new Error(
            `Cannot cancel order with status '${order.status}'. Only pending orders can be cancelled.`
          );
          err.statusCode = 400;
          throw err;
        }

        // Prevent inventory from being restored more than once
        if (order.inventoryRestored) {
          const err = new Error("Inventory for this order has already been restored.");
          err.statusCode = 400;
          throw err;
        }

        order.status = "cancelled";
        order.paymentStatus = "cancelled";
        order.inventoryRestored = true;
        order.statusHistory.push({
          status: "cancelled",
          timestamp: new Date(),
          note: "Cancelled by customer",
        });

        await order.save({ session });

        // Restore variant inventory inside the exact same transaction
        for (const item of order.items) {
          const stockField = `stock.${item.size}`;
          await Product.updateOne(
            { _id: item.product },
            { $inc: { [stockField]: item.qty } },
            { session }
          );
        }

        cancelledOrder = order;
      });
    } catch (txnError) {
      if (
        txnError.code === 20 ||
        txnError.message?.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
        txnError.message?.includes("This MongoDB deployment does not support transactions")
      ) {
        return ApiResponse.error(
          res,
          "Database deployment does not support transactions. A replica set deployment is required to guarantee atomic cancellation.",
          500
        );
      }

      const statusCode = txnError.statusCode || 400;
      console.error("Order cancellation transaction aborted:", txnError.message);
      return ApiResponse.error(res, txnError.message || "Failed to cancel order", statusCode);
    } finally {
      await session.endSession();
    }

    return ApiResponse.success(res, "Order cancelled and stock restored", cancelledOrder);
  } catch (err) {
    console.error("Order cancellation error:", err.message || "Failed to cancel order");
    return ApiResponse.error(res, err.message || "Failed to cancel order", 400);
  }
}
