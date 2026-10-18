import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import {
  createOrder,
  cancelMyOrder,
  recordOrderPayment,
  updateOrderStatus,
} from "../controllers/orderController.js";

let mongod;

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
}

test("Setup in-memory MongoDB Replica Set for Payment System Tests", async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  assert.equal(mongoose.connection.readyState, 1, "Connected to replica set");
});

test("Payment Test 1 — Reject unsupported 'card' and 'test' payment methods", async () => {
  const product = await Product.create({
    name: "Linen Chore Coat",
    category: "Outerwear",
    type: "jacket",
    price: 120,
    sizes: ["M"],
    stock: { M: 10 },
  });

  const unsupportedMethods = ["card", "test", "stripe", "paypal", "crypto"];

  for (const method of unsupportedMethods) {
    const req = {
      body: {
        paymentMethod: method,
        items: [{ productId: String(product._id), size: "M", qty: 1 }],
        customer: { name: "Test Buyer", email: "buyer@test.com", phone: "+94770000000" },
        shippingAddress: { address: "123 Street", city: "Colombo", postalCode: "00100" },
      },
    };
    const res = createMockRes();

    await createOrder(req, res);

    assert.equal(res.statusCode, 400, `Expected 400 Bad Request for unsupported payment method: ${method}`);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /not supported/i);
  }
});

test("Payment Test 2 — COD order creation starts with paymentStatus: 'pending' even if client sends 'paid'", async () => {
  const product = await Product.create({
    name: "Classic Silk Scarf",
    category: "Essentials",
    type: "tee",
    price: 45,
    sizes: ["M"],
    stock: { M: 10 },
  });

  const req = {
    body: {
      paymentMethod: "cod",
      paymentStatus: "paid", // Malicious client attempt to claim instant payment
      items: [{ productId: String(product._id), size: "M", qty: 1 }],
      customer: { name: "Honest Buyer", email: "honest@test.com", phone: "+94770000001" },
      shippingAddress: { address: "456 Avenue", city: "Colombo", postalCode: "00100" },
    },
  };
  const res = createMockRes();

  await createOrder(req, res);

  assert.equal(res.statusCode, 201, "Order created successfully");
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.paymentMethod, "cod");
  assert.equal(res.body.data.paymentStatus, "pending", "paymentStatus must always start as pending for COD");

  const savedOrder = await Order.findById(res.body.data._id);
  assert.equal(savedOrder.paymentStatus, "pending", "Persisted order paymentStatus must be pending");
  assert.equal(savedOrder.currency, "USD", "Currency must default to USD");
});

test("Payment Test 3 — Order totals and shipping fees are calculated server-side using trusted data", async () => {
  const productA = await Product.create({
    name: "Heavyweight Cotton Tee",
    category: "Essentials",
    type: "tee",
    price: 40.5,
    sizes: ["L"],
    stock: { L: 10 },
  });

  // Client attempts to tamper with prices, total, and shipping
  const req = {
    body: {
      paymentMethod: "cod",
      items: [
        {
          productId: String(productA._id),
          size: "L",
          qty: 2,
          price: 1.0, // Client tries to claim it costs $1 instead of $40.50
        },
      ],
      total: 2.0, // Client claims total is $2
      shippingFee: 0, // Client claims free shipping under $150
      customer: { name: "Price Tamperer", email: "tamper@test.com", phone: "+94770000002" },
      shippingAddress: { address: "789 Lane", city: "Colombo", postalCode: "00100" },
    },
  };
  const res = createMockRes();

  await createOrder(req, res);

  assert.equal(res.statusCode, 201);
  const order = res.body.data;

  // Expected: 2 * 40.50 = 81.00 subtotal. Under 150 -> $6 shipping fee. Total = 87.00
  assert.equal(order.total, 87.0);
  assert.equal(order.items[0].price, 40.5);

  const savedOrder = await Order.findById(order._id);
  assert.equal(savedOrder.total, 87.0);
});

test("Payment Test 4 — Free shipping threshold ($150) applies correctly server-side", async () => {
  const expensiveProduct = await Product.create({
    name: "Cashmere Overcoat",
    category: "Outerwear",
    type: "jacket",
    price: 160.0,
    sizes: ["L"],
    stock: { L: 5 },
  });

  const req = {
    body: {
      paymentMethod: "cod",
      items: [{ productId: String(expensiveProduct._id), size: "L", qty: 1 }],
      customer: { name: "VIP Customer", email: "vip@test.com", phone: "+94770000003" },
      shippingAddress: { address: "100 Luxury Way", city: "Colombo", postalCode: "00100" },
    },
  };
  const res = createMockRes();

  await createOrder(req, res);

  assert.equal(res.statusCode, 201);
  // Subtotal is $160 >= $150, shipping fee is $0, total is $160
  assert.equal(res.body.data.total, 160.0);
});

test("Payment Test 5 — Customer cannot mark orders paid (restricted to authorized administrator)", async () => {
  const customer = await User.create({
    name: "Customer Regular",
    email: "customer_reg@test.com",
    password: "Password123!",
    role: "customer",
  });

  const order = await Order.create({
    user: customer._id,
    customer: { name: "Customer Regular", email: "customer_reg@test.com", phone: "+94770000004" },
    shippingAddress: { address: "22 Market Rd", city: "Colombo", postalCode: "00100" },
    items: [{ product: new mongoose.Types.ObjectId(), name: "Item", size: "M", price: 50, qty: 1 }],
    subtotal: 50,
    shipping: 6,
    total: 56,
    paymentMethod: "cod",
    paymentStatus: "pending",
  });

  // Customer tries to call recordOrderPayment
  const reqCustomer = {
    user: customer, // role is "customer"
    params: { id: String(order._id) },
    body: { note: "Customer claiming they paid" },
  };
  const resCustomer = createMockRes();

  await recordOrderPayment(reqCustomer, resCustomer);

  assert.equal(resCustomer.statusCode, 403, "Customer must be rejected with 403 Forbidden");
  assert.equal(resCustomer.body.success, false);

  // Unauthenticated caller
  const reqUnauth = {
    user: null,
    params: { id: String(order._id) },
    body: {},
  };
  const resUnauth = createMockRes();

  await recordOrderPayment(reqUnauth, resUnauth);

  assert.equal(resUnauth.statusCode, 401, "Unauthenticated caller must be rejected with 401 Unauthorized");
});

test("Payment Test 6 — Authorized administrator records COD payment with full audit trail", async () => {
  const admin = await User.create({
    name: "Head Cashier Admin",
    email: "admin_cashier@test.com",
    password: "Password123!",
    role: "admin",
  });

  const order = await Order.create({
    customer: { name: "Jane Doe", email: "jane@test.com", phone: "+94770000005" },
    shippingAddress: { address: "55 Park St", city: "Colombo", postalCode: "00100" },
    items: [{ product: new mongoose.Types.ObjectId(), name: "Linen Shirt", size: "M", price: 75, qty: 1 }],
    subtotal: 75,
    shipping: 6,
    total: 81,
    paymentMethod: "cod",
    paymentStatus: "pending",
  });

  const reqAdmin = {
    user: admin,
    params: { id: String(order._id) },
    body: { note: "COD collected in cash upon courier dispatch" },
  };
  const resAdmin = createMockRes();

  await recordOrderPayment(reqAdmin, resAdmin);

  assert.equal(resAdmin.statusCode, 200, "Admin can record payment");
  assert.equal(resAdmin.body.success, true);
  assert.equal(resAdmin.body.data.paymentStatus, "paid");

  // Verify database record has paymentDetails audit info
  const updatedOrder = await Order.findById(order._id);
  assert.equal(updatedOrder.paymentStatus, "paid");
  assert.ok(updatedOrder.paymentDetails, "paymentDetails must be populated");
  assert.equal(String(updatedOrder.paymentDetails.collectedBy), String(admin._id));
  assert.equal(updatedOrder.paymentDetails.amountCollected, 81);
  assert.equal(updatedOrder.paymentDetails.note, "COD collected in cash upon courier dispatch");
  assert.ok(updatedOrder.paymentDetails.collectedAt instanceof Date);

  // Verify paymentHistory array
  assert.ok(Array.isArray(updatedOrder.paymentHistory));
  assert.equal(updatedOrder.paymentHistory.length, 1);
  assert.equal(updatedOrder.paymentHistory[0].paymentStatus, "paid");
  assert.equal(String(updatedOrder.paymentHistory[0].actor), String(admin._id));
  assert.equal(updatedOrder.paymentHistory[0].note, "COD collected in cash upon courier dispatch");
});

test("Payment Test 7 — Prevent repeated payment confirmation from recording collection twice", async () => {
  const admin = await User.findOne({ role: "admin" });

  const order = await Order.create({
    customer: { name: "Bob Twice", email: "bob@test.com", phone: "+94770000006" },
    shippingAddress: { address: "88 Harbor Rd", city: "Colombo", postalCode: "00100" },
    items: [{ product: new mongoose.Types.ObjectId(), name: "Cap", size: "One Size", price: 30, qty: 1 }],
    subtotal: 30,
    shipping: 6,
    total: 36,
    paymentMethod: "cod",
    paymentStatus: "pending",
  });

  // First payment confirmation
  const req1 = {
    user: admin,
    params: { id: String(order._id) },
    body: { note: "First collection" },
  };
  const res1 = createMockRes();
  await recordOrderPayment(req1, res1);
  assert.equal(res1.statusCode, 200);

  // Duplicate payment confirmation attempt
  const req2 = {
    user: admin,
    params: { id: String(order._id) },
    body: { note: "Duplicate collection attempt" },
  };
  const res2 = createMockRes();
  await recordOrderPayment(req2, res2);

  assert.equal(res2.statusCode, 400, "Duplicate payment confirmation must return 400");
  assert.equal(res2.body.success, false);
  assert.match(res2.body.message, /already been (collected and )?recorded/i);

  // Audit history must not have been duplicated
  const saved = await Order.findById(order._id);
  assert.equal(saved.paymentHistory.length, 1, "paymentHistory must still have exactly 1 record");
});

test("Payment Test 8 — Do not mark an order refunded unless a genuine refund workflow exists", async () => {
  const customer = await User.create({
    name: "Customer Canceller",
    email: "canceller@test.com",
    password: "Password123!",
    role: "customer",
  });

  const product = await Product.create({
    name: "Organic Cotton Boxer",
    category: "Essentials",
    type: "tee",
    price: 25,
    sizes: ["M"],
    stock: { M: 5 },
  });

  const order = await Order.create({
    user: customer._id,
    customer: { name: "Customer Canceller", email: "canceller@test.com", phone: "+94770000007" },
    shippingAddress: { address: "10 Main St", city: "Colombo", postalCode: "00100" },
    items: [{ product: product._id, name: product.name, size: "M", price: 25, qty: 1 }],
    subtotal: 25,
    shipping: 6,
    total: 31,
    paymentMethod: "cod",
    paymentStatus: "pending", // Unpaid COD order
    status: "pending",
  });

  // Customer cancels the order
  const req = {
    user: customer,
    params: { id: String(order._id) },
  };
  const res = createMockRes();

  await cancelMyOrder(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.status, "cancelled");

  // Payment status must be 'cancelled', NOT 'refunded' (no simulated refund)
  assert.equal(res.body.data.paymentStatus, "cancelled");
  assert.notEqual(res.body.data.paymentStatus, "refunded");

  const dbOrder = await Order.findById(order._id);
  assert.equal(dbOrder.paymentStatus, "cancelled");
  assert.notEqual(dbOrder.paymentStatus, "refunded");
});

test("Payment Test 9 — Reject manual payment confirmation on cancelled order", async () => {
  const admin = await User.findOne({ role: "admin" });

  const cancelledOrder = await Order.create({
    customer: { name: "Cancelled Person", email: "cancelled@test.com", phone: "+94770000008" },
    shippingAddress: { address: "99 Void St", city: "Colombo", postalCode: "00100" },
    items: [{ product: new mongoose.Types.ObjectId(), name: "Item", size: "M", price: 20, qty: 1 }],
    subtotal: 20,
    shipping: 6,
    total: 26,
    paymentMethod: "cod",
    paymentStatus: "cancelled",
    status: "cancelled",
  });

  const req = {
    user: admin,
    params: { id: String(cancelledOrder._id) },
    body: { note: "Attempting to pay for cancelled order" },
  };
  const res = createMockRes();

  await recordOrderPayment(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /cancelled/i);
});

test("Payment Test 10 — Delivering a COD order records payment collection and audit log automatically", async () => {
  const admin = await User.findOne({ role: "admin" });

  const order = await Order.create({
    customer: { name: "Courier Recipient", email: "courier@test.com", phone: "+94770000009" },
    shippingAddress: { address: "12 Delivery St", city: "Colombo", postalCode: "00100" },
    items: [{ product: new mongoose.Types.ObjectId(), name: "Coat", size: "L", price: 100, qty: 1 }],
    subtotal: 100,
    shipping: 6,
    total: 106,
    paymentMethod: "cod",
    paymentStatus: "pending",
    status: "shipped",
  });

  const req = {
    user: admin,
    params: { id: String(order._id) },
    body: { status: "delivered" },
  };
  const res = createMockRes();

  await updateOrderStatus(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.status, "delivered");
  assert.equal(res.body.data.paymentStatus, "paid");

  const dbOrder = await Order.findById(order._id);
  assert.equal(dbOrder.paymentStatus, "paid");
  assert.ok(dbOrder.paymentDetails);
  assert.equal(dbOrder.paymentDetails.amountCollected, 106);
  assert.ok(dbOrder.paymentHistory.some((h) => h.paymentStatus === "paid"));
});

test("Cleanup Payment Test Replica Set", async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});
