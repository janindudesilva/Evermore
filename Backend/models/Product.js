import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    line: { type: String, default: "" },
    category: {
      type: String,
      enum: ["Essentials", "Outerwear", "New Arrivals", "Featured"],
      required: true,
    },
    tag: { type: String, default: null },
    type: {
      type: String,
      enum: ["tee", "shirt", "jacket", "trousers", "dress", "skirt"],
      required: true,
    },
    color: { type: String, default: "#14140f" },
    price: { type: Number, required: true, min: 0 },
    compareAt: { type: Number, default: null },
    description: { type: String, default: "" },
    features: { type: [String], default: [] },
    images: { type: [String], default: [] },
    sizes: { type: [String], default: [] },
    // stock per size, e.g. { S: 12, M: 8, L: 0 }
    stock: { type: Map, of: Number, default: {} },
    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", description: "text" });

export default mongoose.model("Product", productSchema);
