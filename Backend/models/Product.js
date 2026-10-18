import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Product name is required"], trim: true },
    line: { type: String, default: "" },
    category: {
      type: String,
      enum: {
        values: ["Essentials", "Outerwear", "New Arrivals", "Featured"],
        message: "{VALUE} is not a valid category",
      },
      required: [true, "Category is required"],
    },
    tag: { type: String, default: null },
    type: {
      type: String,
      enum: {
        values: ["tee", "shirt", "jacket", "trousers", "dress", "skirt"],
        message: "{VALUE} is not a valid product type",
      },
      required: [true, "Product type is required"],
    },
    color: { type: String, default: "#14140f" },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    compareAt: {
      type: Number,
      default: null,
      validate: {
        validator: function (v) {
          return v === null || v === undefined || v >= 0;
        },
        message: "Compare at price must be positive",
      },
    },
    description: { type: String, default: "", trim: true },
    features: { type: [String], default: [] },
    images: { type: [String], default: [] },
    sizes: {
      type: [String],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v),
        message: "Sizes must be an array",
      },
    },
    // stock per size, e.g. { S: 12, M: 8, L: 0 }
    stock: {
      type: Map,
      of: {
        type: Number,
        min: [0, "Stock cannot be negative"],
        validate: {
          validator: Number.isInteger,
          message: "{VALUE} is not an integer",
        },
      },
      default: () => new Map(),
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviews: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: { flattenMaps: true },
    toObject: { flattenMaps: true },
  }
);

// Compound and text indexes for search, filtering, and admin listing
productSchema.index({ name: "text", description: "text" });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ isActive: 1, createdAt: -1 });

// Method to get available stock for a specific size
productSchema.methods.getStockForSize = function (size) {
  if (!this.stock) return 0;
  if (this.stock instanceof Map) {
    return this.stock.get(size) ?? 0;
  }
  return this.stock[size] ?? 0;
};

export default mongoose.model("Product", productSchema);
