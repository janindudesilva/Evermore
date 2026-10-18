import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    size: { type: String, required: true },
    color: { type: String, default: "" },
    qty: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "{VALUE} is not an integer quantity",
      },
    },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, default: "Sri Lanka", trim: true },
  },
  { _id: false }
);

// Backward-compatible guestInfo schema
const guestInfoSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    postalCode: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      sparse: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "Order must include at least one item",
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    shipping: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "packed",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],
    paymentMethod: {
      type: String,
      enum: ["cod", "card", "test"],
      default: "cod",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "cancelled"],
      default: "pending",
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    customer: {
      type: customerSchema,
      required: true,
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guestInfo: {
      type: guestInfoSchema,
      default: null,
    },
  },
  { timestamps: true }
);

// Ensure status history is initialized
orderSchema.pre("validate", function () {
  // If guestInfo provided and customer/shippingAddress missing, populate them
  if (this.guestInfo && (!this.customer || !this.customer.name)) {
    this.customer = {
      name: this.guestInfo.name,
      email: this.guestInfo.email,
      phone: this.guestInfo.phone,
    };
  }
  if (this.guestInfo && (!this.shippingAddress || !this.shippingAddress.address)) {
    this.shippingAddress = {
      address: this.guestInfo.address,
      city: this.guestInfo.city,
      postalCode: this.guestInfo.postalCode,
      country: "Sri Lanka",
    };
  }

  // Populate guestInfo backward compatibility
  if (!this.guestInfo && this.customer && this.shippingAddress) {
    this.guestInfo = {
      name: this.customer.name,
      email: this.customer.email,
      phone: this.customer.phone,
      address: this.shippingAddress.address,
      city: this.shippingAddress.city,
      postalCode: this.shippingAddress.postalCode,
    };
  }

  // Generate order number if not present
  if (!this.orderNumber) {
    const timestampPart = Date.now().toString().slice(-6);
    const randomPart = Math.floor(100 + Math.random() * 900);
    this.orderNumber = `EV-${timestampPart}${randomPart}`;
  }

  // Add initial status to statusHistory if empty
  if (!this.statusHistory || this.statusHistory.length === 0) {
    this.statusHistory = [
      {
        status: this.status || "pending",
        timestamp: new Date(),
        note: "Order created",
      },
    ];
  }
});

// Indexes for query performance
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

export default mongoose.model("Order", orderSchema);
