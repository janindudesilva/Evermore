import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoServerError } from "mongodb";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { createOrder, cancelMyOrder, updateOrderStatus } from "../controllers/orderController.js";

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

test("Setup in-memory MongoDB Replica Set for ACID Transactions", async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  assert.equal(mongoose.connection.readyState, 1, "Connected to replica set");
});

test("ACID Test 1 — Two customers purchase the last item simultaneously", async () => {
  const product = await Product.create({
    name: "Final Silk Trench",
    category: "Outerwear",
    type: "jacket",
    price: 320,
    sizes: ["M"],
    stock: { M: 1 }, // Only 1 garment available
  });

  const customerA = await User.create({
    name: "Customer A",
    email: "buyer_a@test.com",
    password: "Password123!",
    role: "customer",
  });

  const customerB = await User.create({
    name: "Customer B",
    email: "buyer_b@test.com",
    password: "Password123!",
    role: "customer",
  });

  const payloadA = {
    items: [{ productId: String(product._id), size: "M", qty: 1 }],
    customer: { name: "Customer A", email: "buyer_a@test.com", phone: "+94771111111" },
    shippingAddress: { address: "100 Street A", city: "Colombo", postalCode: "00100" },
    paymentMethod: "cod",
  };

  const payloadB = {
    items: [{ productId: String(product._id), size: "M", qty: 1 }],
    customer: { name: "Customer B", email: "buyer_b@test.com", phone: "+94772222222" },
    shippingAddress: { address: "200 Street B", city: "Colombo", postalCode: "00100" },
    paymentMethod: "cod",
  };

  const resA = createMockRes();
  const resB = createMockRes();

  // Execute simultaneous checkout requests
  await Promise.all([
    createOrder({ body: payloadA, user: customerA, headers: {} }, resA),
    createOrder({ body: payloadB, user: customerB, headers: {} }, resB),
  ]);

  const results = [resA, resB];
  const successful = results.filter((r) => r.statusCode === 201);
  const conflicts = results.filter((r) => r.statusCode === 409 || r.statusCode === 400);

  assert.equal(successful.length, 1, "Exactly one customer order must succeed (201)");
  assert.equal(conflicts.length, 1, "The competing customer must fail (409/400)");

  // Check database state: exactly 1 order in DB and stock must be 0, NEVER negative
  const productAfter = await Product.findById(product._id);
  assert.equal(productAfter.getStockForSize("M"), 0, "Stock must be 0, never negative");

  const ordersCount = await Order.countDocuments({ "items.product": product._id });
  assert.equal(ordersCount, 1, "Exactly one order persisted in database");
});

test("ACID Test 2 — Multi-item checkout fails halfway through", async () => {
  const inStockItem = await Product.create({
    name: "Cashmere Sweater",
    category: "Essentials",
    type: "shirt",
    price: 150,
    sizes: ["L"],
    stock: { L: 5 },
  });

  const outOfStockItem = await Product.create({
    name: "Linen Trousers",
    category: "Essentials",
    type: "trousers",
    price: 90,
    sizes: ["32"],
    stock: { "32": 0 }, // Out of stock
  });

  const customer = await User.create({
    name: "Multi Item Customer",
    email: "multi@test.com",
    password: "Password123!",
    role: "customer",
  });

  const multiPayload = {
    items: [
      { productId: String(inStockItem._id), size: "L", qty: 2 },
      { productId: String(outOfStockItem._id), size: "32", qty: 1 }, // Will fail!
    ],
    customer: { name: "Multi Item Customer", email: "multi@test.com", phone: "+94773333333" },
    shippingAddress: { address: "15 Ocean View", city: "Galle", postalCode: "80000" },
    paymentMethod: "cod",
  };

  const res = createMockRes();
  await createOrder({ body: multiPayload, user: customer, headers: {} }, res);

  assert.equal(res.statusCode, 400, "Must fail with 400 when an item is out of stock");
  assert.match(res.body.message, /insufficient stock/i);

  // Transaction rollback check: inStockItem stock must remain untouched (5)
  const item1After = await Product.findById(inStockItem._id);
  assert.equal(item1After.getStockForSize("L"), 5, "Stock for item 1 must remain 5, no partial deduction");

  // No order created
  const orderCount = await Order.countDocuments({ "customer.email": "multi@test.com" });
  assert.equal(orderCount, 0, "No partial order persisted in database");
});

test("ACID Test 3 — Database write fails during order creation", async () => {
  const product = await Product.create({
    name: "Failover Jacket",
    category: "Outerwear",
    type: "jacket",
    price: 200,
    sizes: ["M"],
    stock: { M: 10 },
  });

  // Inject a failure inside Order.create within transaction
  const originalCreate = Order.create;
  Order.create = async function () {
    throw new Error("Simulated database write failure during order creation");
  };

  try {
    const payload = {
      items: [{ productId: String(product._id), size: "M", qty: 2 }],
      customer: { name: "Crash Test", email: "crashtest@test.com", phone: "+94778889999" },
      shippingAddress: { address: "123 Error St", city: "Colombo", postalCode: "00100" },
      paymentMethod: "cod",
    };

    const res = createMockRes();
    await createOrder({ body: payload, user: null, headers: {} }, res);

    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /simulated database write failure/i);

    // Stock must NOT be deducted because transaction aborted
    const productAfter = await Product.findById(product._id);
    assert.equal(productAfter.getStockForSize("M"), 10, "Stock must remain 10 after aborted transaction");
  } finally {
    Order.create = originalCreate;
  }
});

test("ACID Test 4 — Database write fails during cancellation", async () => {
  const product = await Product.create({
    name: "Cancel Fail Item",
    category: "Essentials",
    type: "tee",
    price: 50,
    sizes: ["S"],
    stock: { S: 8 },
  });

  const customer = await User.create({
    name: "Cancel Fail Customer",
    email: "cancelfail@test.com",
    password: "Password123!",
    role: "customer",
  });

  // Place order
  const orderRes = createMockRes();
  await createOrder(
    {
      body: {
        items: [{ productId: String(product._id), size: "S", qty: 2 }],
        customer: { name: "Cancel Fail Customer", email: "cancelfail@test.com", phone: "+94770001234" },
        shippingAddress: { address: "55 cancel st", city: "Colombo", postalCode: "00100" },
      },
      user: customer,
      headers: {},
    },
    orderRes
  );
  assert.equal(orderRes.statusCode, 201);
  const orderId = orderRes.body.data._id;

  // Stock is now 8 - 2 = 6
  let checkStock = await Product.findById(product._id);
  assert.equal(checkStock.getStockForSize("S"), 6);

  // Mock failure during Product.updateOne in cancellation
  const originalUpdateOne = Product.updateOne;
  let updateOneCallCount = 0;
  Product.updateOne = async function (filter, update, options) {
    updateOneCallCount++;
    if (options?.session) {
      throw new Error("Simulated product update error during cancellation transaction");
    }
    return originalUpdateOne.call(this, filter, update, options);
  };

  try {
    const cancelRes = createMockRes();
    await cancelMyOrder({ params: { id: String(orderId) }, user: customer }, cancelRes);

    assert.equal(cancelRes.statusCode, 400);
    assert.match(cancelRes.body.message, /simulated product update error/i);

    // Verify ACID rollback: Order status MUST still be 'pending', not 'cancelled'
    const orderAfter = await Order.findById(orderId);
    assert.equal(orderAfter.status, "pending", "Order status must remain pending after aborted cancellation");
    assert.equal(orderAfter.inventoryRestored, false, "inventoryRestored must remain false");

    // Stock must remain 6, not partially restored
    checkStock = await Product.findById(product._id);
    assert.equal(checkStock.getStockForSize("S"), 6, "Stock must remain 6 (unrestored)");
  } finally {
    Product.updateOne = originalUpdateOne;
  }
});

test("ACID Test 5 — Two cancellation requests occur simultaneously", async () => {
  const product = await Product.create({
    name: "Dual Cancel Jacket",
    category: "Outerwear",
    type: "jacket",
    price: 180,
    sizes: ["L"],
    stock: { L: 10 },
  });

  const customer = await User.create({
    name: "Dual Cancel User",
    email: "dualcancel@test.com",
    password: "Password123!",
    role: "customer",
  });

  // Create order with 3 units
  const createRes = createMockRes();
  await createOrder(
    {
      body: {
        items: [{ productId: String(product._id), size: "L", qty: 3 }],
        customer: { name: "Dual Cancel User", email: "dualcancel@test.com", phone: "+94775556666" },
        shippingAddress: { address: "99 Dual Way", city: "Colombo", postalCode: "00100" },
      },
      user: customer,
      headers: {},
    },
    createRes
  );
  assert.equal(createRes.statusCode, 201);
  const orderId = createRes.body.data._id;

  // Stock is now 10 - 3 = 7
  let checkStock = await Product.findById(product._id);
  assert.equal(checkStock.getStockForSize("L"), 7);

  // Send two cancellation requests simultaneously
  const res1 = createMockRes();
  const res2 = createMockRes();

  await Promise.all([
    cancelMyOrder({ params: { id: String(orderId) }, user: customer }, res1),
    cancelMyOrder({ params: { id: String(orderId) }, user: customer }, res2),
  ]);

  const results = [res1, res2];
  const successes = results.filter((r) => r.statusCode === 200);
  const failures = results.filter((r) => r.statusCode === 400);

  assert.equal(successes.length, 1, "Exactly one cancellation must succeed");
  assert.equal(failures.length, 1, "Concurrent cancellation must fail");

  // Stock must only be restored by 3 (7 + 3 = 10), NEVER double-restored to 13
  checkStock = await Product.findById(product._id);
  assert.equal(checkStock.getStockForSize("L"), 10, "Stock must be restored exactly once (10)");

  const orderAfter = await Order.findById(orderId);
  assert.equal(orderAfter.status, "cancelled");
  assert.equal(orderAfter.inventoryRestored, true);
});

test("ACID Test 6 — The same cancellation is repeated after success", async () => {
  const product = await Product.create({
    name: "Repeat Cancel Shirt",
    category: "Essentials",
    type: "shirt",
    price: 70,
    sizes: ["M"],
    stock: { M: 4 },
  });

  const customer = await User.create({
    name: "Repeat User",
    email: "repeatcancel@test.com",
    password: "Password123!",
    role: "customer",
  });

  // Create order with 2 units
  const createRes = createMockRes();
  await createOrder(
    {
      body: {
        items: [{ productId: String(product._id), size: "M", qty: 2 }],
        customer: { name: "Repeat User", email: "repeatcancel@test.com", phone: "+94774443333" },
        shippingAddress: { address: "12 Repeat Ln", city: "Colombo", postalCode: "00100" },
      },
      user: customer,
      headers: {},
    },
    createRes
  );
  const orderId = createRes.body.data._id;

  // First cancellation: succeeds
  const firstCancelRes = createMockRes();
  await cancelMyOrder({ params: { id: String(orderId) }, user: customer }, firstCancelRes);
  assert.equal(firstCancelRes.statusCode, 200);

  let checkStock = await Product.findById(product._id);
  assert.equal(checkStock.getStockForSize("M"), 4, "Stock restored to original 4");

  // Immediate second cancellation attempt: must fail
  const secondCancelRes = createMockRes();
  await cancelMyOrder({ params: { id: String(orderId) }, user: customer }, secondCancelRes);
  assert.equal(secondCancelRes.statusCode, 400, "Second cancellation must fail with 400");
  assert.match(secondCancelRes.body.message, /only pending orders can be cancelled/i);

  // Verify stock was NOT restored again (remains 4, not 6)
  checkStock = await Product.findById(product._id);
  assert.equal(checkStock.getStockForSize("M"), 4, "Stock must not be restored twice");
});

test("ACID Test 7 — The server loses its connection during an inventory operation", async () => {
  const product = await Product.create({
    name: "Connection Loss Coat",
    category: "Outerwear",
    type: "jacket",
    price: 400,
    sizes: ["XL"],
    stock: { XL: 6 },
  });

  // Start transaction, write decrement, then abort / simulate abrupt connection termination
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await Product.updateOne(
      { _id: product._id },
      { $inc: { "stock.XL": -3 } },
      { session }
    );
    // Simulate connection drop / termination before commit
    await session.abortTransaction();
  } finally {
    await session.endSession();
  }

  // Stock in database must remain 6 because transaction was never committed
  const productAfter = await Product.findById(product._id);
  assert.equal(productAfter.getStockForSize("XL"), 6, "Uncommitted writes must be completely discarded");
});

test("ACID Test 8 — The transaction is retried after a transient failure", async () => {
  const session = await mongoose.startSession();
  let attempts = 0;

  try {
    await session.withTransaction(async () => {
      attempts++;
      if (attempts === 1) {
        // Simulate a transient write conflict / TransientTransactionError on attempt 1
        const transientError = new MongoServerError({ message: "Write conflict on document" });
        transientError.addErrorLabel("TransientTransactionError");
        throw transientError;
      }
      // Attempt 2 succeeds
    });

    assert.equal(attempts, 2, "Transaction must automatically retry after TransientTransactionError");
  } finally {
    await session.endSession();
  }
});

test("Teardown Replica Set for ACID Transactions", async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
