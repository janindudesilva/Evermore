import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../server.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

describe("EVERMORE End-to-End API Workflows", () => {
  let mongod;
  let server;
  let baseUrl;

  let customerToken;
  let customerId;
  let adminToken;
  let testProductId;
  let guestOrderId;
  let authOrderId;

  before(async () => {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    // Seed Admin user
    await User.create({
      name: "System Admin",
      email: "admin@evermore.test",
      password: "AdminPassword2026!",
      role: "admin",
    });

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
  });

  it("Scenario 1 & 2 — Register customer and login", async () => {
    // 1. Register customer
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Amaya Fernando",
        email: "amaya@evermore.test",
        password: "CustomerPassword123!",
      }),
    });
    const regData = await regRes.json();
    assert.equal(regRes.status, 201);
    assert.equal(regData.success, true);
    assert.equal(regData.data.user.role, "customer");
    customerId = regData.data.user._id;

    // 2. Login as customer
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "amaya@evermore.test",
        password: "CustomerPassword123!",
      }),
    });
    const loginData = await loginRes.json();
    assert.equal(loginRes.status, 200);
    assert.ok(loginData.data.token);
    customerToken = loginData.data.token;

    // 3. Login as Admin
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@evermore.test",
        password: "AdminPassword2026!",
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert.equal(adminLoginRes.status, 200);
    adminToken = adminLoginData.data.token;
  });

  it("Scenario 3 & 4 — Product CRUD authorization", async () => {
    // Customer attempts to create product -> rejected 403
    const rejectRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        name: "Hacked Jacket",
        category: "Outerwear",
        type: "jacket",
        price: 10,
      }),
    });
    assert.equal(rejectRes.status, 403, "Customer must be denied product creation");

    // Admin creates product -> 201
    const createRes = await fetch(`${baseUrl}/api/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "E2E Field Jacket",
        line: "Outerwear",
        category: "Outerwear",
        type: "jacket",
        price: 120,
        sizes: ["S", "M", "L"],
        stock: { S: 10, M: 5, L: 8 },
        description: "Tested over real HTTP",
      }),
    });
    const createData = await createRes.json();
    assert.equal(createRes.status, 201);
    assert.ok(createData.data._id);
    testProductId = createData.data._id;
  });

  it("Scenario 5 & 6 — Browse catalog and product details", async () => {
    // Get all products
    const listRes = await fetch(`${baseUrl}/api/products?category=Outerwear`);
    const listData = await listRes.json();
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listData.data));
    assert.equal(listData.data.length, 1);
    assert.equal(listData.data[0]._id, testProductId);

    // Get product by ID
    const detailRes = await fetch(`${baseUrl}/api/products/${testProductId}`);
    const detailData = await detailRes.json();
    assert.equal(detailRes.status, 200);
    assert.equal(detailData.data.name, "E2E Field Jacket");
    assert.equal(detailData.data.stock.M, 5);
  });

  it("Scenario 7 — Complete Guest Checkout", async () => {
    const guestRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ productId: testProductId, size: "M", qty: 2 }],
        customer: { name: "Guest User", email: "guest@test.com", phone: "+94770001111" },
        shippingAddress: { address: "10 Temple Rd", city: "Negombo", postalCode: "11500" },
        paymentMethod: "cod",
      }),
    });
    const guestData = await guestRes.json();
    assert.equal(guestRes.status, 201);
    assert.equal(guestData.data.user, null, "Guest order has no user reference");
    assert.equal(guestData.data.status, "pending");
    assert.equal(guestData.data.total, 240); // 120 * 2 = 240 >= 150 -> Free shipping
    assert.equal(guestData.data.shipping, 0);
    guestOrderId = guestData.data._id;

    // Stock for M decremented from 5 to 3
    const p = await Product.findById(testProductId);
    assert.equal(p.getStockForSize("M"), 3);
  });

  it("Scenario 8 & 9 — Complete Authenticated Checkout and verify stock", async () => {
    const authOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        items: [{ productId: testProductId, size: "M", qty: 1 }],
        customer: { name: "Amaya Fernando", email: "amaya@evermore.test", phone: "+94772223333" },
        shippingAddress: { address: "25 Sea Ave", city: "Colombo", postalCode: "00300" },
        paymentMethod: "cod",
      }),
    });
    const authOrderData = await authOrderRes.json();
    assert.equal(authOrderRes.status, 201);
    assert.equal(String(authOrderData.data.user), String(customerId));
    assert.equal(authOrderData.data.subtotal, 120);
    assert.equal(authOrderData.data.shipping, 6); // Under 150 -> $6 shipping
    assert.equal(authOrderData.data.total, 126);
    authOrderId = authOrderData.data._id;

    // Stock for M decremented from 3 to 2
    const p = await Product.findById(testProductId);
    assert.equal(p.getStockForSize("M"), 2);
  });

  it("Scenario 10 — Customer order history and isolation", async () => {
    const myOrdersRes = await fetch(`${baseUrl}/api/orders/mine`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const myOrdersData = await myOrdersRes.json();
    assert.equal(myOrdersRes.status, 200);
    assert.equal(myOrdersData.data.orders.length, 1);
    assert.equal(String(myOrdersData.data.orders[0]._id), String(authOrderId));

    // Customer cannot view another customer's or guest order
    const getGuestOrderRes = await fetch(`${baseUrl}/api/orders/${guestOrderId}`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(getGuestOrderRes.status, 403, "Customer cannot access guest order by ID");
  });

  it("Scenario 11 & 12 — Admin order listing and status update", async () => {
    // Admin lists all orders
    const allOrdersRes = await fetch(`${baseUrl}/api/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const allOrdersData = await allOrdersRes.json();
    assert.equal(allOrdersRes.status, 200);
    assert.equal(allOrdersData.data.orders.length, 2);

    // Admin updates guest order status to confirmed
    const updateRes = await fetch(`${baseUrl}/api/orders/${guestOrderId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "confirmed" }),
    });
    const updateData = await updateRes.json();
    assert.equal(updateRes.status, 200);
    assert.equal(updateData.data.status, "confirmed");
  });

  it("Scenario 13 & 14 — Customer self-cancels pending order and stock restores", async () => {
    const cancelRes = await fetch(`${baseUrl}/api/orders/${authOrderId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const cancelData = await cancelRes.json();
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelData.data.status, "cancelled");

    // Stock for M restored from 2 back to 3
    const p = await Product.findById(testProductId);
    assert.equal(p.getStockForSize("M"), 3, "Stock must be restored to 3 after cancellation");
  });

  it("Scenario 15 & 16 — Contact and Newsletter inquiries", async () => {
    // Contact form inquiry
    const contactRes = await fetch(`${baseUrl}/api/inquiries/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Kasun Perera",
        email: "kasun@example.com",
        subject: "Sizing",
        message: "Is the jacket true to size?",
      }),
    });
    const contactData = await contactRes.json();
    assert.equal(contactRes.status, 200);
    assert.equal(contactData.success, true);

    // Newsletter signup
    const newsRes = await fetch(`${baseUrl}/api/inquiries/newsletter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "kasun@example.com" }),
    });
    const newsData = await newsRes.json();
    assert.equal(newsRes.status, 200);
    assert.equal(newsData.success, true);
  });

  it("Scenario 17 — Health check endpoint", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.status, "ok");
    assert.equal(data.app, "EVERMORE API");
    assert.equal(data.database, "connected");
  });
});
