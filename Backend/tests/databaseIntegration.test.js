import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { createOrder, cancelMyOrder, updateOrderStatus } from "../controllers/orderController.js";

let mongod;

// Mock Response helper for testing controller endpoints
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

test("Setup in-memory MongoDB test instance", async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  assert.equal(mongoose.connection.readyState, 1, "Mongoose must be connected to in-memory instance");
});

test("Database Integration — User model indexes, hashing, and role security", async () => {
  // 1. Create customer
  const user = await User.create({
    name: "Test Customer",
    email: "customer@test.com",
    password: "securePassword123!",
  });

  assert.equal(user.role, "customer");
  assert.notEqual(user.password, "securePassword123!", "Password must be hashed with bcrypt");
  assert.equal(await user.comparePassword("securePassword123!"), true);
  assert.equal(await user.comparePassword("wrongPassword"), false);

  // 2. Enforce unique email index
  await assert.rejects(
    () =>
      User.create({
        name: "Duplicate User",
        email: "customer@test.com",
        password: "anotherPassword123!",
      }),
    /E11000.*duplicate key error/
  );
});

test("Database Integration — Product model variant stock and lookup", async () => {
  const product = await Product.create({
    name: "Test Field Jacket",
    category: "Outerwear",
    type: "jacket",
    price: 120,
    sizes: ["S", "M", "L"],
    stock: { S: 10, M: 5, L: 0 },
  });

  assert.equal(product.getStockForSize("S"), 10);
  assert.equal(product.getStockForSize("M"), 5);
  assert.equal(product.getStockForSize("L"), 0);
  assert.equal(product.getStockForSize("XL"), 0);
});

test("Database Integration & Concurrency — Two simultaneous buyers of last item in real MongoDB", async () => {
  const scarceProduct = await Product.create({
    name: "Limited Edition Jacket",
    category: "Outerwear",
    type: "jacket",
    price: 200,
    sizes: ["M"],
    stock: { M: 1 }, // Only 1 unit in stock
  });

  const buyerA_Req = {
    body: {
      items: [{ productId: String(scarceProduct._id), size: "M", qty: 1 }],
      customer: { name: "Buyer A", email: "buyera@example.com", phone: "+94711111111" },
      shippingAddress: { address: "100 A St", city: "Colombo", postalCode: "00100" },
      paymentMethod: "cod",
    },
    user: null,
    headers: {},
  };

  const buyerB_Req = {
    body: {
      items: [{ productId: String(scarceProduct._id), size: "M", qty: 1 }],
      customer: { name: "Buyer B", email: "buyerb@example.com", phone: "+94722222222" },
      shippingAddress: { address: "200 B St", city: "Colombo", postalCode: "00100" },
      paymentMethod: "cod",
    },
    user: null,
    headers: {},
  };

  const resA = createMockRes();
  const resB = createMockRes();

  // Execute concurrently against MongoDB
  await Promise.all([createOrder(buyerA_Req, resA), createOrder(buyerB_Req, resB)]);

  const responses = [resA, resB];
  const successful = responses.filter((r) => r.statusCode === 201);
  const failed = responses.filter((r) => r.statusCode === 400 || r.statusCode === 409);

  assert.equal(successful.length, 1, "Exactly one order must be committed to MongoDB");
  assert.equal(failed.length, 1, "Exactly one order must be rejected");

  // Inspect MongoDB product stock directly
  const refreshedProduct = await Product.findById(scarceProduct._id);
  const finalStock = refreshedProduct.getStockForSize("M");
  assert.equal(finalStock, 0, "Final stock in MongoDB must be 0, never negative (no overselling)");
});

test("Database Integration — Multi-item order failure rolls back deducted stock in MongoDB", async () => {
  const itemInStock = await Product.create({
    name: "Cotton Tee",
    category: "Essentials",
    type: "tee",
    price: 30,
    sizes: ["M"],
    stock: { M: 10 },
  });

  const itemOutOfStock = await Product.create({
    name: "Silk Skirt",
    category: "New Arrivals",
    type: "skirt",
    price: 80,
    sizes: ["S"],
    stock: { S: 0 }, // Out of stock
  });

  const req = {
    body: {
      items: [
        { productId: String(itemInStock._id), size: "M", qty: 3 },
        { productId: String(itemOutOfStock._id), size: "S", qty: 1 },
      ],
      customer: { name: "Jane", email: "jane@test.com", phone: "+94733333333" },
      shippingAddress: { address: "300 C St", city: "Colombo", postalCode: "00100" },
      paymentMethod: "cod",
    },
    user: null,
    headers: {},
  };

  const res = createMockRes();
  await createOrder(req, res);

  assert.equal(res.statusCode, 400, "Multi-item order must fail");
  assert.match(res.body.message, /Insufficient stock/i);

  // Verify that itemInStock had its 3 units rolled back to 10 in MongoDB
  const rechecked = await Product.findById(itemInStock._id);
  assert.equal(rechecked.getStockForSize("M"), 10, "Stock for first item must be rolled back to 10 in database");
});

test("Database Integration — Idempotency key prevents duplicate orders in MongoDB", async () => {
  const product = await Product.create({
    name: "Everyday Shorts",
    category: "Essentials",
    type: "trousers",
    price: 45,
    sizes: ["M"],
    stock: { M: 20 },
  });

  const idempKey = `test-idemp-${Date.now()}`;
  const orderPayload = {
    items: [{ productId: String(product._id), size: "M", qty: 2 }],
    customer: { name: "John Doe", email: "john@test.com", phone: "+94744444444" },
    shippingAddress: { address: "400 D St", city: "Colombo", postalCode: "00100" },
    paymentMethod: "cod",
    idempotencyKey: idempKey,
  };

  const res1 = createMockRes();
  await createOrder({ body: orderPayload, user: null, headers: {} }, res1);
  assert.equal(res1.statusCode, 201, "First order creation must succeed with 201");
  const orderId1 = res1.body.data._id;

  // Immediate second attempt with same idempotency key (simulating network retry)
  const res2 = createMockRes();
  await createOrder({ body: orderPayload, user: null, headers: {} }, res2);
  assert.equal(res2.statusCode, 200, "Second attempt must return 200 with existing order");
  assert.equal(String(res2.body.data._id), String(orderId1), "Returned order ID must match original order");

  // Verify stock in MongoDB was only decremented ONCE (20 - 2 = 18)
  const productCheck = await Product.findById(product._id);
  assert.equal(productCheck.getStockForSize("M"), 18, "Stock must be decremented only once for replayed order");
});

test("Database Integration — Order self-cancellation restores stock and blocks repeated cancellation", async () => {
  const user = await User.create({
    name: "Buyer",
    email: "buyer_cancel@test.com",
    password: "Password123!",
  });

  const product = await Product.create({
    name: "Canvas Hat",
    category: "Essentials",
    type: "tee",
    price: 25,
    sizes: ["M"],
    stock: { M: 5 },
  });

  // 1. Create order for 2 items
  const resOrder = createMockRes();
  await createOrder(
    {
      body: {
        items: [{ productId: String(product._id), size: "M", qty: 2 }],
        customer: { name: "Buyer", email: "buyer_cancel@test.com", phone: "+94755555555" },
        shippingAddress: { address: "500 E St", city: "Colombo", postalCode: "00100" },
        paymentMethod: "cod",
      },
      user,
      headers: {},
    },
    resOrder
  );

  assert.equal(resOrder.statusCode, 201);
  const createdOrderId = resOrder.body.data._id;

  // Stock should be 3 in DB
  let p = await Product.findById(product._id);
  assert.equal(p.getStockForSize("M"), 3);

  // 2. Customer cancels order
  const resCancel1 = createMockRes();
  await cancelMyOrder({ params: { id: String(createdOrderId) }, user }, resCancel1);
  assert.equal(resCancel1.statusCode, 200);
  assert.equal(resCancel1.body.data.status, "cancelled");

  // Stock should be restored to 5 in DB
  p = await Product.findById(product._id);
  assert.equal(p.getStockForSize("M"), 5, "Stock in MongoDB must be restored to 5 after cancellation");

  // 3. Repeated / Duplicate cancellation attempt must be rejected
  const resCancel2 = createMockRes();
  await cancelMyOrder({ params: { id: String(createdOrderId) }, user }, resCancel2);
  assert.equal(resCancel2.statusCode, 400, "Repeated cancellation must be rejected");

  // Stock must NOT be incremented again (must stay 5)
  p = await Product.findById(product._id);
  assert.equal(p.getStockForSize("M"), 5, "Stock in MongoDB must remain 5 and NOT be incremented twice");
});

test("Database Integration — Admin order status transition state machine in MongoDB", async () => {
  const order = await Order.create({
    items: [{ product: new mongoose.Types.ObjectId(), name: "Linen Shirt", price: 80, size: "M", qty: 1 }],
    subtotal: 80,
    shipping: 6,
    total: 86,
    status: "pending",
    paymentMethod: "cod",
    paymentStatus: "pending",
    customer: { name: "Customer", email: "cust@test.com", phone: "+94766666666" },
    shippingAddress: { address: "600 F St", city: "Colombo", postalCode: "00100" },
  });

  // Valid transition: pending -> confirmed
  const res1 = createMockRes();
  await updateOrderStatus({ params: { id: String(order._id) }, body: { status: "confirmed" } }, res1);
  assert.equal(res1.statusCode, 200);
  assert.equal(res1.body.data.status, "confirmed");

  // Valid transition: confirmed -> processing
  const res2 = createMockRes();
  await updateOrderStatus({ params: { id: String(order._id) }, body: { status: "processing" } }, res2);
  assert.equal(res2.statusCode, 200);

  // Invalid transition: processing -> pending (cannot go backwards)
  const res3 = createMockRes();
  await updateOrderStatus({ params: { id: String(order._id) }, body: { status: "pending" } }, res3);
  assert.equal(res3.statusCode, 400, "Backwards transition must be rejected");

  // Valid: processing -> packed -> shipped -> delivered
  await updateOrderStatus({ params: { id: String(order._id) }, body: { status: "packed" } }, createMockRes());
  await updateOrderStatus({ params: { id: String(order._id) }, body: { status: "shipped" } }, createMockRes());
  const resDelivered = createMockRes();
  await updateOrderStatus({ params: { id: String(order._id) }, body: { status: "delivered" } }, resDelivered);
  assert.equal(resDelivered.statusCode, 200);
  assert.equal(resDelivered.body.data.status, "delivered");
  assert.equal(resDelivered.body.data.paymentStatus, "paid", "COD order transitioning to delivered must mark paymentStatus as paid");
});

test("Database Integration — Schema backward compatibility with legacy documents", async () => {
  // Legacy product document without stock map or line
  const legacyProd = await Product.collection.insertOne({
    name: "Legacy Trouser",
    category: "Essentials",
    type: "trousers",
    price: 90,
    sizes: ["30", "32"],
    isActive: true,
  });

  const fetchedProd = await Product.findById(legacyProd.insertedId);
  assert.equal(fetchedProd.name, "Legacy Trouser");
  assert.equal(fetchedProd.getStockForSize("30"), 0, "Missing stock map should safely return 0 without throwing");

  // Legacy order document with guestInfo instead of customer/shippingAddress
  const legacyOrder = await Order.collection.insertOne({
    items: [{ product: legacyProd.insertedId, name: "Legacy Trouser", price: 90, size: "30", qty: 1 }],
    subtotal: 90,
    shipping: 6,
    total: 96,
    status: "pending",
    guestInfo: {
      name: "Old Guest",
      email: "oldguest@test.com",
      phone: "+94777777777",
      address: "Old St",
      city: "Colombo",
      postalCode: "00100",
    },
  });

  const fetchedOrder = await Order.findById(legacyOrder.insertedId);
  assert.equal(fetchedOrder.guestInfo?.name, "Old Guest");
  assert.equal(fetchedOrder.total, 96);
});

test("Teardown in-memory MongoDB test instance", async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
