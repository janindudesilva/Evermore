import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    size: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

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
    items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },
    subtotal: { type: Number, required: true },
    shipping: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    // Exactly one of these is set — determines account vs guest order.
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    guestInfo: { type: guestInfoSchema, default: null },
  },
  { timestamps: true }
);

orderSchema.pre("validate", function (next) {
  if (!this.user && !this.guestInfo) {
    return next(new Error("Order must have either a user or guestInfo"));
  }
  next();
});

export default mongoose.model("Order", orderSchema);
