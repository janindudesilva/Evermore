import test from "node:test";
import assert from "node:assert/strict";

// State machine definition as defined in orderController
const ALLOWED_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

function isValidTransition(current, next) {
  const allowed = ALLOWED_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

function calculateOrderTotals(items, productCatalog) {
  let subtotal = 0;
  for (const item of items) {
    const product = productCatalog[item.productId];
    if (!product) throw new Error(`Product not found: ${item.productId}`);
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 50) {
      throw new Error("Invalid quantity: must be positive integer between 1 and 50");
    }
    subtotal += product.price * item.qty;
  }
  subtotal = Math.round(subtotal * 100) / 100;
  const shipping = subtotal >= 150 || subtotal === 0 ? 0 : 6;
  const total = Math.round((subtotal + shipping) * 100) / 100;
  return { subtotal, shipping, total };
}

test("Order State Machine — Enforces valid transitions and rejects invalid jumps", () => {
  // Allowed transitions
  assert.equal(isValidTransition("pending", "confirmed"), true);
  assert.equal(isValidTransition("pending", "cancelled"), true);
  assert.equal(isValidTransition("confirmed", "processing"), true);
  assert.equal(isValidTransition("processing", "packed"), true);
  assert.equal(isValidTransition("packed", "shipped"), true);
  assert.equal(isValidTransition("shipped", "delivered"), true);

  // Forbidden transitions (E-09)
  assert.equal(isValidTransition("cancelled", "delivered"), false, "Cancelled order cannot become delivered");
  assert.equal(isValidTransition("cancelled", "pending"), false, "Cancelled order cannot revert to pending");
  assert.equal(isValidTransition("delivered", "processing"), false, "Delivered order cannot revert to processing");
  assert.equal(isValidTransition("pending", "delivered"), false, "Cannot jump directly from pending to delivered without shipping");
  assert.equal(isValidTransition("delivered", "cancelled"), false, "Delivered order cannot be cancelled directly without return flow");
});

test("Order Pricing & Validation — Enforces integer quantities and shipping policy", () => {
  const mockCatalog = {
    prod1: { price: 32 },
    prod2: { price: 128 },
  };

  // Valid order under $150 gets $6 shipping
  const order1 = calculateOrderTotals([{ productId: "prod1", qty: 2 }], mockCatalog);
  assert.equal(order1.subtotal, 64);
  assert.equal(order1.shipping, 6);
  assert.equal(order1.total, 70);

  // Order over $150 gets FREE shipping ($0)
  const order2 = calculateOrderTotals(
    [
      { productId: "prod1", qty: 1 },
      { productId: "prod2", qty: 1 },
    ],
    mockCatalog
  );
  assert.equal(order2.subtotal, 160);
  assert.equal(order2.shipping, 0);
  assert.equal(order2.total, 160);

  // Reject zero quantity
  assert.throws(
    () => calculateOrderTotals([{ productId: "prod1", qty: 0 }], mockCatalog),
    /Invalid quantity/
  );

  // Reject negative quantity
  assert.throws(
    () => calculateOrderTotals([{ productId: "prod1", qty: -3 }], mockCatalog),
    /Invalid quantity/
  );

  // Reject decimal quantity
  assert.throws(
    () => calculateOrderTotals([{ productId: "prod1", qty: 1.5 }], mockCatalog),
    /Invalid quantity/
  );

  // Reject excessively large quantity (> 50)
  assert.throws(
    () => calculateOrderTotals([{ productId: "prod1", qty: 1000 }], mockCatalog),
    /Invalid quantity/
  );
});

test("Order Customer & Address Snapshot Validation", () => {
  function validateOrderPayload(payload) {
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error("Empty items");
    }
    if (!payload.customer?.name || payload.customer.name.trim().length < 2) {
      throw new Error("Missing customer name");
    }
    if (!payload.customer?.email || !/^\S+@\S+\.\S+$/.test(payload.customer.email)) {
      throw new Error("Invalid customer email");
    }
    if (!payload.customer?.phone || payload.customer.phone.trim().length < 5) {
      throw new Error("Missing customer phone");
    }
    if (!payload.shippingAddress?.address || payload.shippingAddress.address.trim().length < 3) {
      throw new Error("Missing shipping address");
    }
    if (!payload.shippingAddress?.city || !payload.shippingAddress?.postalCode) {
      throw new Error("Incomplete city or postal code");
    }
    return true;
  }

  // Complete payload passes
  const valid = validateOrderPayload({
    items: [{ productId: "p1", size: "M", qty: 1 }],
    customer: { name: "Jane Doe", email: "jane@example.com", phone: "+94712345678" },
    shippingAddress: { address: "123 Main St", city: "Colombo", postalCode: "00100" },
  });
  assert.equal(valid, true);

  // Missing address fails (E-05)
  assert.throws(
    () =>
      validateOrderPayload({
        items: [{ productId: "p1", size: "M", qty: 1 }],
        customer: { name: "Jane Doe", email: "jane@example.com", phone: "+94712345678" },
        shippingAddress: { address: "", city: "Colombo", postalCode: "00100" },
      }),
    /Missing shipping address/
  );

  // Invalid email fails
  assert.throws(
    () =>
      validateOrderPayload({
        items: [{ productId: "p1", size: "M", qty: 1 }],
        customer: { name: "Jane Doe", email: "not-an-email", phone: "+94712345678" },
        shippingAddress: { address: "123 Main", city: "Colombo", postalCode: "00100" },
      }),
    /Invalid customer email/
  );
});
