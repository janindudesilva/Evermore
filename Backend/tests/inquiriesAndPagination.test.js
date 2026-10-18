import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import Inquiry from "../models/Inquiry.js";
import Newsletter from "../models/Newsletter.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import {
  submitContact,
  submitNewsletter,
  unsubscribeNewsletter,
  getInquiries,
  updateInquiryStatus,
} from "../controllers/inquiryController.js";
import { getProducts } from "../controllers/productController.js";
import { getAllOrders } from "../controllers/orderController.js";

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

test("Setup in-memory MongoDB Replica Set for Inquiries and Pagination Tests", async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  assert.equal(mongoose.connection.readyState, 1, "Connected to replica set");
});

test("Part A.1 — Successful contact inquiry storage in MongoDB with timestamps & status", async () => {
  const req = {
    body: {
      name: "Dharshana Silva",
      email: "dharshana@atelier.test",
      subject: "Bespoke Sizing",
      message: "Can this jacket be adjusted for custom sleeve measurements?",
    },
    ip: "192.168.1.100",
  };
  const res = createMockRes();

  await submitContact(req, res);

  assert.equal(res.statusCode, 200, "Submission should return 200");
  assert.equal(res.body.success, true);
  assert.match(res.body.message, /inquiry has been received/i);

  // Verify persistence in MongoDB
  const savedInquiry = await Inquiry.findById(res.body.data.id);
  assert.ok(savedInquiry, "Inquiry must be stored in database");
  assert.equal(savedInquiry.name, "Dharshana Silva");
  assert.equal(savedInquiry.email, "dharshana@atelier.test");
  assert.equal(savedInquiry.subject, "Bespoke Sizing");
  assert.equal(savedInquiry.status, "new", "Initial status must be 'new'");
  assert.ok(savedInquiry.createdAt instanceof Date, "Submission timestamp must exist");
});

test("Part A.2 — Invalid contact form submissions rejected with 400", async () => {
  // 1. Missing name
  const res1 = createMockRes();
  await submitContact({ body: { email: "valid@test.com", message: "Hello world" } }, res1);
  assert.equal(res1.statusCode, 400);
  assert.match(res1.body.message, /name/i);

  // 2. Invalid email format
  const res2 = createMockRes();
  await submitContact({ body: { name: "Valid Name", email: "not-an-email", message: "Hello world" } }, res2);
  assert.equal(res2.statusCode, 400);
  assert.match(res2.body.message, /valid email/i);

  // 3. Message too short
  const res3 = createMockRes();
  await submitContact({ body: { name: "Valid Name", email: "valid@test.com", message: "Hi" } }, res3);
  assert.equal(res3.statusCode, 400);
  assert.match(res3.body.message, /message/i);
});

test("Part A.3 — Failed database write on contact inquiry returns 500 error cleanly", async () => {
  // Temporarily stub Inquiry.create to throw a database error
  const originalCreate = Inquiry.create;
  Inquiry.create = async () => {
    throw new Error("Simulated MongoDB connection failure during write");
  };

  try {
    const req = {
      body: {
        name: "Test User",
        email: "test@error.com",
        message: "This will fail on write",
      },
    };
    const res = createMockRes();

    await submitContact(req, res);

    assert.equal(res.statusCode, 500, "Should return 500 on database failure");
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /database error/i);
  } finally {
    Inquiry.create = originalCreate;
  }
});

test("Part A.4 — Admin reviews and updates contact inquiry status", async () => {
  const inquiry = await Inquiry.create({
    name: "Customer Review",
    email: "review@customer.test",
    subject: "Order Inquiry",
    message: "When will the coat restock?",
    status: "new",
  });

  // Admin fetches inquiries
  const reqList = { query: { page: "1", limit: "10" } };
  const resList = createMockRes();
  await getInquiries(reqList, resList);

  assert.equal(resList.statusCode, 200);
  assert.ok(resList.body.data.inquiries.length >= 1);
  assert.ok(resList.body.data.pagination.total >= 1);

  // Admin marks inquiry as resolved
  const reqUpdate = {
    params: { id: String(inquiry._id) },
    body: { status: "resolved", notes: "Answered via email." },
  };
  const resUpdate = createMockRes();
  await updateInquiryStatus(reqUpdate, resUpdate);

  assert.equal(resUpdate.statusCode, 200);
  assert.equal(resUpdate.body.data.status, "resolved");

  const checkDb = await Inquiry.findById(inquiry._id);
  assert.equal(checkDb.status, "resolved");
  assert.equal(checkDb.notes, "Answered via email.");
});

test("Part B.1 & B.2 — Newsletter subscription and duplicate prevention", async () => {
  const email = "subscriber_test@evermore.test";

  // First subscription
  const req1 = { body: { email, consent: true } };
  const res1 = createMockRes();
  await submitNewsletter(req1, res1);

  assert.equal(res1.statusCode, 200);
  assert.equal(res1.body.success, true);

  // Verify persistence in MongoDB
  const subInDb = await Newsletter.findOne({ email });
  assert.ok(subInDb, "Subscription must be stored in database");
  assert.equal(subInDb.status, "subscribed");
  assert.equal(subInDb.consent, true);

  // Second subscription attempt with the exact same email -> Duplicate rejected (409)
  const req2 = { body: { email, consent: true } };
  const res2 = createMockRes();
  await submitNewsletter(req2, res2);

  assert.equal(res2.statusCode, 409, "Duplicate subscription must return 409 Conflict");
  assert.equal(res2.body.success, false);
  assert.match(res2.body.message, /already subscribed/i);
});

test("Part B.3 & B.4 — Newsletter consent validation and unsubscribe / re-subscribe flow", async () => {
  const email = "unsub_flow@evermore.test";

  // 1. Consent denied (consent: false) -> 400
  const resDenied = createMockRes();
  await submitNewsletter({ body: { email, consent: false } }, resDenied);
  assert.equal(resDenied.statusCode, 400);
  assert.match(resDenied.body.message, /consent/i);

  // 2. Subscribe with consent -> 200
  const resSub = createMockRes();
  await submitNewsletter({ body: { email, consent: true } }, resSub);
  assert.equal(resSub.statusCode, 200);

  // 3. Unsubscribe -> 200
  const resUnsub = createMockRes();
  await unsubscribeNewsletter({ body: { email } }, resUnsub);
  assert.equal(resUnsub.statusCode, 200);
  assert.match(resUnsub.body.message, /unsubscribed/i);

  const unsubRecord = await Newsletter.findOne({ email });
  assert.equal(unsubRecord.status, "unsubscribed");
  assert.ok(unsubRecord.unsubscribedAt instanceof Date);

  // 4. Re-subscribing re-activates subscriber
  const resResub = createMockRes();
  await submitNewsletter({ body: { email, consent: true } }, resResub);
  assert.equal(resResub.statusCode, 200);
  assert.match(resResub.body.message, /welcome back/i);

  const resubRecord = await Newsletter.findOne({ email });
  assert.equal(resubRecord.status, "subscribed");
  assert.equal(resubRecord.unsubscribedAt, null);
});

test("Part C.1 — Product pagination with more records than one page", async () => {
  // Clear any products and insert 15 products
  await Product.deleteMany({});

  const productDocs = [];
  for (let i = 1; i <= 15; i++) {
    productDocs.push({
      name: `Pagination Test Jacket ${i}`,
      category: "Outerwear",
      type: "jacket",
      price: 100 + i,
      sizes: ["M"],
      stock: { M: 5 },
      isActive: true,
    });
  }
  await Product.insertMany(productDocs);

  // Fetch Page 1 (limit 10)
  const reqP1 = { query: { page: "1", limit: "10" } };
  const resP1 = createMockRes();
  await getProducts(reqP1, resP1);

  assert.equal(resP1.statusCode, 200);
  assert.equal(resP1.body.data.length, 10, "Page 1 must contain exactly 10 products");
  assert.equal(resP1.body.pagination.total, 15, "Total products must be 15");
  assert.equal(resP1.body.pagination.page, 1);
  assert.equal(resP1.body.pagination.pages, 2, "15 items with limit 10 must span 2 pages");

  // Fetch Page 2 (limit 10)
  const reqP2 = { query: { page: "2", limit: "10" } };
  const resP2 = createMockRes();
  await getProducts(reqP2, resP2);

  assert.equal(resP2.statusCode, 200);
  assert.equal(resP2.body.data.length, 5, "Page 2 must contain remaining 5 products");
  assert.equal(resP2.body.pagination.page, 2);
});

test("Part C.2 — Order pagination with more records than one page", async () => {
  await Order.deleteMany({});

  const orderDocs = [];
  for (let i = 1; i <= 15; i++) {
    orderDocs.push({
      orderNumber: `ORD-PAG-${1000 + i}`,
      customer: { name: `Customer ${i}`, email: `c${i}@test.com`, phone: "+94770000000" },
      shippingAddress: { address: `${i} High St`, city: "Colombo", postalCode: "00100" },
      items: [{ product: new mongoose.Types.ObjectId(), name: "Garment", size: "M", price: 50, qty: 1 }],
      subtotal: 50,
      shipping: 6,
      total: 56,
      paymentMethod: "cod",
      paymentStatus: "pending",
      status: "pending",
    });
  }
  await Order.insertMany(orderDocs);

  // Fetch Page 1 (limit 10)
  const reqO1 = { query: { page: "1", limit: "10" } };
  const resO1 = createMockRes();
  await getAllOrders(reqO1, resO1);

  assert.equal(resO1.statusCode, 200);
  assert.equal(resO1.body.data.orders.length, 10, "Page 1 must contain exactly 10 orders");
  assert.equal(resO1.body.data.pagination.total, 15, "Total orders must be 15");
  assert.equal(resO1.body.data.pagination.pages, 2);

  // Fetch Page 2 (limit 10)
  const reqO2 = { query: { page: "2", limit: "10" } };
  const resO2 = createMockRes();
  await getAllOrders(reqO2, resO2);

  assert.equal(resO2.statusCode, 200);
  assert.equal(resO2.body.data.orders.length, 5, "Page 2 must contain remaining 5 orders");
  assert.equal(resO2.body.data.pagination.page, 2);
});

test("Cleanup Inquiries and Pagination Test Replica Set", async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});
