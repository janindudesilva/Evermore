import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { createOrder } from "../controllers/orderController.js";
import { createProduct, updateProduct } from "../controllers/productController.js";

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

test("Setup in-memory MongoDB Replica Set for Retries and Stock Tests", async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  assert.equal(mongoose.connection.readyState, 1, "Connected to replica set");
});

test("Task A.1 & A.2 — Retry after server has already created the order reuses stable idempotency key", async () => {
  const product = await Product.create({
    name: "Linen Camp Shirt",
    category: "Essentials",
    type: "shirt",
    price: 85,
    sizes: ["M"],
    stock: { M: 5 },
  });

  const idempotencyKey = "test-idemp-stable-key-001";
  const payload = {
    paymentMethod: "cod",
    idempotencyKey,
    items: [{ productId: String(product._id), size: "M", qty: 1 }],
    customer: { name: "Retrying Buyer", email: "retry_buyer@test.com", phone: "+94770001111" },
    shippingAddress: { address: "100 Galle Rd", city: "Colombo", postalCode: "00300" },
  };

  // Initial attempt (e.g. server successfully created order, but client network dropped before ACK)
  const req1 = { body: payload, headers: { "idempotency-key": idempotencyKey } };
  const res1 = createMockRes();
  await createOrder(req1, res1);

  assert.equal(res1.statusCode, 201, "First attempt should create order");
  const firstOrderId = res1.body.data._id;

  // Verify stock was deducted once: 5 - 1 = 4
  const prodAfterFirst = await Product.findById(product._id);
  assert.equal(prodAfterFirst.stock.get("M"), 4);

  // Client retries with the exact same idempotency key and payload
  const req2 = { body: payload, headers: { "idempotency-key": idempotencyKey } };
  const res2 = createMockRes();
  await createOrder(req2, res2);

  assert.equal(res2.statusCode, 200, "Retry should return existing order with 200 OK");
  assert.equal(res2.body.success, true);
  assert.equal(String(res2.body.data._id), String(firstOrderId), "Should return the exact same order");

  // Crucial: stock must NOT have been deducted a second time
  const prodAfterRetry = await Product.findById(product._id);
  assert.equal(prodAfterRetry.stock.get("M"), 4, "Stock must remain 4, no double deduction");

  // Only one order must exist in database
  const orderCount = await Order.countDocuments({ idempotencyKey });
  assert.equal(orderCount, 1, "Exactly one order must exist for this key");
});

test("Task A.3 — Reuse an idempotency key with a different payload is rejected", async () => {
  const product = await Product.create({
    name: "Pleated Trousers",
    category: "Essentials",
    type: "trousers",
    price: 110,
    sizes: ["32"],
    stock: { "32": 10 },
  });

  const sharedKey = "test-idemp-shared-key-002";
  const payloadOriginal = {
    paymentMethod: "cod",
    idempotencyKey: sharedKey,
    items: [{ productId: String(product._id), size: "32", qty: 1 }],
    customer: { name: "User One", email: "user_one@test.com", phone: "+94770002222" },
    shippingAddress: { address: "10 Main St", city: "Colombo", postalCode: "00100" },
  };

  const res1 = createMockRes();
  await createOrder({ body: payloadOriginal, headers: {} }, res1);
  assert.equal(res1.statusCode, 201);

  // Attempt to reuse sharedKey with a DIFFERENT delivery address (tampered or mismatched payload)
  const payloadMismatched = {
    ...payloadOriginal,
    shippingAddress: { address: "999 Fraud Lane", city: "Kandy", postalCode: "20000" },
  };

  const res2 = createMockRes();
  await createOrder({ body: payloadMismatched, headers: {} }, res2);

  assert.equal(res2.statusCode, 400, "Reusing key with different payload must be rejected");
  assert.equal(res2.body.success, false);
  assert.match(res2.body.message, /different order payload/i);
});

test("Task A.4 — Rapid concurrent double-click checkout creates only one order", async () => {
  const product = await Product.create({
    name: "Limited Trench Coat",
    category: "Outerwear",
    type: "jacket",
    price: 250,
    sizes: ["L"],
    stock: { L: 2 },
  });

  const concurrentKey = "test-idemp-concurrent-click-003";
  const payload = {
    paymentMethod: "cod",
    idempotencyKey: concurrentKey,
    items: [{ productId: String(product._id), size: "L", qty: 1 }],
    customer: { name: "Fast Clicker", email: "fast_clicker@test.com", phone: "+94770003333" },
    shippingAddress: { address: "55 Racecourse Ave", city: "Colombo", postalCode: "00700" },
  };

  // Dispatch two simultaneous calls with the exact same payload and key (simulating rapid double-click)
  const [resA, resB] = [createMockRes(), createMockRes()];
  await Promise.all([
    createOrder({ body: payload, headers: {} }, resA),
    createOrder({ body: payload, headers: {} }, resB),
  ]);

  // At least one must be 201, and the other must be either 200 (idempotent retrieve) or 201
  const statuses = [resA.statusCode, resB.statusCode];
  assert.ok(statuses.includes(201), "At least one request must succeed in creating order");

  // Crucial: exactly 1 unit was deducted from inventory (2 - 1 = 1)
  const updatedProd = await Product.findById(product._id);
  assert.equal(updatedProd.stock.get("L"), 1, "Stock must only be deducted once despite concurrent calls");

  // Exactly 1 order in database
  const count = await Order.countDocuments({ idempotencyKey: concurrentKey });
  assert.equal(count, 1, "Exactly one order created for concurrent click");
});

test("Task B.1 & B.2 — Create a product without stock is rejected (no automatic 10-unit assumption)", async () => {
  const req = {
    body: {
      name: "Unstocked Silk Shirt",
      price: 95,
      category: "Essentials",
      type: "shirt",
      sizes: ["S", "M"],
      // stock is omitted!
    },
  };
  const res = createMockRes();

  await createProduct(req, res);

  assert.equal(res.statusCode, 400, "Creating product without stock must return 400");
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /explicit stock/i);
});

test("Task B.3 — Create a product with missing size in stock is rejected", async () => {
  const req = {
    body: {
      name: "Partially Stocked Jacket",
      price: 180,
      category: "Outerwear",
      type: "jacket",
      sizes: ["S", "M", "L"],
      stock: { S: 5, M: 8 }, // 'L' is missing
    },
  };
  const res = createMockRes();

  await createProduct(req, res);

  assert.equal(res.statusCode, 400, "Missing stock for size 'L' must return 400");
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /size 'L'/i);
});

test("Task B.4 — Create a product with zero stock (sold out) is permitted", async () => {
  const req = {
    body: {
      name: "Sold Out Archive Blazer",
      price: 290,
      category: "Outerwear",
      type: "jacket",
      sizes: ["S", "M"],
      stock: { S: 0, M: 0 }, // Explicit zero stock
    },
  };
  const res = createMockRes();

  await createProduct(req, res);

  assert.equal(res.statusCode, 201, "Zero stock product should be created successfully");
  assert.equal(res.body.success, true);

  const productInDb = await Product.findById(res.body.data._id);
  assert.equal(productInDb.stock.get("S"), 0);
  assert.equal(productInDb.stock.get("M"), 0);
});

test("Task B.5 — Reject negative or fractional stock values", async () => {
  // Negative stock
  const reqNegative = {
    body: {
      name: "Negative Stock Trouser",
      price: 120,
      category: "Essentials",
      type: "trousers",
      sizes: ["30"],
      stock: { "30": -3 },
    },
  };
  const resNegative = createMockRes();
  await createProduct(reqNegative, resNegative);
  assert.equal(resNegative.statusCode, 400, "Negative stock must be rejected");
  assert.match(resNegative.body.message, /non-negative integer/i);

  // Fractional stock
  const reqFractional = {
    body: {
      name: "Fractional Stock Tee",
      price: 45,
      category: "Essentials",
      type: "tee",
      sizes: ["M"],
      stock: { M: 4.75 },
    },
  };
  const resFractional = createMockRes();
  await createProduct(reqFractional, resFractional);
  assert.equal(resFractional.statusCode, 400, "Fractional stock must be rejected");
  assert.match(resFractional.body.message, /non-negative integer/i);
});

test("Task B.8 — Edit an existing product without changing stock preserves inventory", async () => {
  const product = await Product.create({
    name: "Merino Wool Sweater",
    category: "Essentials",
    type: "shirt",
    price: 140,
    sizes: ["S", "M", "L"],
    stock: { S: 3, M: 7, L: 0 },
  });

  // Admin edits only name, price, and description, omitting 'stock'
  const reqUpdate = {
    params: { id: String(product._id) },
    body: {
      name: "Merino Wool Crewneck Sweater (Updated)",
      price: 155,
      description: "Updated luxury weave details",
    },
  };
  const resUpdate = createMockRes();

  await updateProduct(reqUpdate, resUpdate);

  assert.equal(resUpdate.statusCode, 200, "Product update should succeed");
  assert.equal(resUpdate.body.data.price, 155);

  // Inventory must remain intact: S:3, M:7, L:0
  const refreshed = await Product.findById(product._id);
  assert.equal(refreshed.stock.get("S"), 3);
  assert.equal(refreshed.stock.get("M"), 7);
  assert.equal(refreshed.stock.get("L"), 0);
});

test("Task B.8 — Edit existing product updating stock enforces non-negative integers", async () => {
  const product = await Product.create({
    name: "Linen Drawstring Pant",
    category: "Essentials",
    type: "trousers",
    price: 95,
    sizes: ["S", "M"],
    stock: { S: 5, M: 5 },
  });

  // Admin updates stock with valid values (including 0)
  const reqValid = {
    params: { id: String(product._id) },
    body: {
      stock: { S: 0, M: 12 },
    },
  };
  const resValid = createMockRes();
  await updateProduct(reqValid, resValid);
  assert.equal(resValid.statusCode, 200);

  const updatedProd = await Product.findById(product._id);
  assert.equal(updatedProd.stock.get("S"), 0);
  assert.equal(updatedProd.stock.get("M"), 12);

  // Admin attempts invalid negative stock update
  const reqInvalid = {
    params: { id: String(product._id) },
    body: {
      stock: { S: -1, M: 10 },
    },
  };
  const resInvalid = createMockRes();
  await updateProduct(reqInvalid, resInvalid);
  assert.equal(resInvalid.statusCode, 400, "Invalid negative stock update must be rejected");
});

test("Cleanup Retries and Stock Replica Set", async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});
