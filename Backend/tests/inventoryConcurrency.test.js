import test from "node:test";
import assert from "node:assert/strict";

/**
 * In-memory thread-safe simulation of MongoDB's atomic conditional update:
 * db.products.updateOne({ _id, [`stock.${size}`]: { $gte: qty } }, { $inc: { [`stock.${size}`]: -qty } })
 */
class AtomicInventoryStore {
  constructor(initialCatalog) {
    this.catalog = JSON.parse(JSON.stringify(initialCatalog));
    this.mutex = Promise.resolve();
  }

  // Simulates MongoDB document-level atomic conditional update
  async atomicDecrement(productId, size, qty) {
    // Acquire mutex to simulate atomic document engine serialization
    const release = await this._lock();
    try {
      const product = this.catalog[productId];
      if (!product || !product.isActive) {
        return { success: false, reason: "NOT_FOUND" };
      }
      if (!product.sizes.includes(size)) {
        return { success: false, reason: "INVALID_SIZE" };
      }

      const currentStock = product.stock[size] ?? 0;
      if (currentStock < qty) {
        return { success: false, reason: "INSUFFICIENT_STOCK", available: currentStock };
      }

      // Decrement atomically
      product.stock[size] = currentStock - qty;
      return { success: true, remaining: product.stock[size] };
    } finally {
      release();
    }
  }

  async atomicIncrement(productId, size, qty) {
    const release = await this._lock();
    try {
      const product = this.catalog[productId];
      if (product && product.stock) {
        product.stock[size] = (product.stock[size] ?? 0) + qty;
      }
    } finally {
      release();
    }
  }

  _lock() {
    let resolver;
    const p = new Promise((resolve) => {
      resolver = resolve;
    });
    const current = this.mutex;
    this.mutex = current.then(() => p);
    return current.then(() => resolver);
  }

  getStock(productId, size) {
    return this.catalog[productId]?.stock[size] ?? 0;
  }
}

test("Phase 3 Concurrency Requirement — Two customers purchase the last available item simultaneously", async () => {
  const store = new AtomicInventoryStore({
    "jacket-001": {
      name: "Field Jacket",
      isActive: true,
      sizes: ["S", "M", "L"],
      stock: { S: 5, M: 1, L: 4 }, // Exactly 1 item in size M
    },
  });

  assert.equal(store.getStock("jacket-001", "M"), 1, "Initial stock for size M must be exactly 1");

  // Two customers attempt to buy size M at the exact same moment
  const attemptOrder = async (customerId) => {
    // Simulates createOrder atomic check & decrement
    const result = await store.atomicDecrement("jacket-001", "M", 1);
    if (result.success) {
      return { customerId, status: "SUCCESS" };
    } else {
      return { customerId, status: "FAILED", error: "Item just sold out. Please review your cart." };
    }
  };

  const [customerA, customerB] = await Promise.all([
    attemptOrder("Customer_A"),
    attemptOrder("Customer_B"),
  ]);

  const results = [customerA, customerB];
  const successes = results.filter((r) => r.status === "SUCCESS");
  const failures = results.filter((r) => r.status === "FAILED");

  // Verifications
  assert.equal(successes.length, 1, "Exactly one customer should succeed");
  assert.equal(failures.length, 1, "Exactly one customer should fail");
  assert.match(failures[0].error, /sold out/i, "Failing customer receives clear out-of-stock message");

  // Stock integrity
  const finalStock = store.getStock("jacket-001", "M");
  assert.equal(finalStock, 0, "Stock should be 0, never negative (no overselling)");
});

test("Phase 3 Concurrency — Multi-item order failure triggers inventory rollback", async () => {
  const store = new AtomicInventoryStore({
    "tee-001": {
      name: "Everyday Tee",
      isActive: true,
      sizes: ["S", "M"],
      stock: { S: 5, M: 2 },
    },
    "trouser-001": {
      name: "Wide Trouser",
      isActive: true,
      sizes: ["30", "32"],
      stock: { "30": 0, "32": 4 }, // Size 30 is out of stock!
    },
  });

  const orderItems = [
    { productId: "tee-001", size: "S", qty: 2 },
    { productId: "trouser-001", size: "30", qty: 1 }, // Will fail!
  ];

  const deductions = [];
  let orderSucceeded = true;

  for (const item of orderItems) {
    const res = await store.atomicDecrement(item.productId, item.size, item.qty);
    if (res.success) {
      deductions.push(item);
    } else {
      orderSucceeded = false;
      break;
    }
  }

  assert.equal(orderSucceeded, false, "Order should fail because second item is out of stock");

  // If order failed, execute compensating rollback
  if (!orderSucceeded) {
    for (const d of deductions) {
      await store.atomicIncrement(d.productId, d.size, d.qty);
    }
  }

  // Verify stock was restored to original value
  assert.equal(store.getStock("tee-001", "S"), 5, "Stock for item 1 must be restored to 5 after rollback");
  assert.equal(store.getStock("trouser-001", "30"), 0, "Stock for out-of-stock item remains 0");
});

test("Order Cancellation — Stock is restored upon eligible cancellation", async () => {
  const store = new AtomicInventoryStore({
    "dress-001": {
      name: "Bias Slip Dress",
      isActive: true,
      sizes: ["S", "M"],
      stock: { S: 3, M: 4 },
    },
  });

  // Customer buys 2 of size S
  const dec = await store.atomicDecrement("dress-001", "S", 2);
  assert.equal(dec.success, true);
  assert.equal(store.getStock("dress-001", "S"), 1);

  // Customer cancels the pending order
  await store.atomicIncrement("dress-001", "S", 2);
  assert.equal(store.getStock("dress-001", "S"), 3, "Stock returned to 3 after cancellation");
});
