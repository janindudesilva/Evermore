import Product from "../models/Product.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const ALLOWED_PRODUCT_FIELDS = [
  "name",
  "line",
  "category",
  "tag",
  "type",
  "color",
  "price",
  "compareAt",
  "description",
  "features",
  "images",
  "sizes",
  "stock",
  "isActive",
];

function sanitizeProductPayload(body) {
  const sanitized = {};
  for (const field of ALLOWED_PRODUCT_FIELDS) {
    if (body[field] !== undefined) {
      sanitized[field] = body[field];
    }
  }
  return sanitized;
}

// GET /api/products?category=Essentials&q=jacket&page=1&limit=24
export async function getProducts(req, res) {
  try {
    const { category, q } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const filter = { isActive: true };
    if (category && category !== "All") filter.category = category;
    if (q && q.trim()) filter.$text = { $search: q.trim() };

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Provide data array with pagination metadata attached to ensure backward compatibility
    return res.status(200).json({
      success: true,
      message: "Products fetched",
      data: products,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error("Fetch products error:", err);
    return ApiResponse.error(res, "Could not retrieve products", 500);
  }
}

// GET /api/products/:id
export async function getProductById(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return ApiResponse.error(res, "Product not found", 404);
    }
    return ApiResponse.success(res, "Product fetched", product);
  } catch (err) {
    return ApiResponse.error(res, "Product not found", 404);
  }
}

// POST /api/products (admin only)
export async function createProduct(req, res) {
  try {
    const payload = sanitizeProductPayload(req.body);

    if (!payload.name || payload.price === undefined || !payload.category || !payload.type) {
      return ApiResponse.error(
        res,
        "Name, price, category, and type are required to create a product",
        400
      );
    }

    const priceNum = Number(payload.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return ApiResponse.error(res, "Price must be a non-negative number", 400);
    }
    payload.price = priceNum;

    // Require explicit clothing sizes
    if (!Array.isArray(payload.sizes) || payload.sizes.length === 0) {
      return ApiResponse.error(res, "Product must have at least one clothing size specified", 400);
    }

    // Require explicit valid stock quantities per selected size; remove automatic assumptions of 10 units
    if (!payload.stock || typeof payload.stock !== "object" || Array.isArray(payload.stock)) {
      return ApiResponse.error(
        res,
        "Explicit stock quantities are required for all selected sizes before making product available",
        400
      );
    }

    const sanitizedStock = {};
    for (const size of payload.sizes) {
      const rawVal = payload.stock[size];
      if (rawVal === undefined || rawVal === null || rawVal === "") {
        return ApiResponse.error(res, `Explicit stock quantity is required for size '${size}'`, 400);
      }
      const num = Number(rawVal);
      if (!Number.isInteger(num) || num < 0) {
        return ApiResponse.error(res, `Stock quantity for size '${size}' must be a non-negative integer`, 400);
      }
      sanitizedStock[size] = num;
    }
    payload.stock = sanitizedStock;

    const product = await Product.create(payload);
    return ApiResponse.success(res, "Product created successfully", product, 201);
  } catch (err) {
    console.error("Create product error:", err.message || "Failed to create product");
    return ApiResponse.error(res, err.message || "Failed to create product", 400);
  }
}

// PUT /api/products/:id (admin only)
export async function updateProduct(req, res) {
  try {
    const payload = sanitizeProductPayload(req.body);

    const existing = await Product.findById(req.params.id);
    if (!existing) return ApiResponse.error(res, "Product not found", 404);

    if (payload.price !== undefined) {
      const priceNum = Number(payload.price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        return ApiResponse.error(res, "Price must be a non-negative number", 400);
      }
      payload.price = priceNum;
    }

    if (payload.sizes !== undefined) {
      if (!Array.isArray(payload.sizes) || payload.sizes.length === 0) {
        return ApiResponse.error(res, "Product must have at least one clothing size specified", 400);
      }
    }

    const existingStock = existing.stock instanceof Map
      ? Object.fromEntries(existing.stock)
      : (existing.stock || {});

    // Do not automatically overwrite existing product inventory during editing
    if (payload.stock === undefined) {
      if (payload.sizes !== undefined) {
        // Sizes updated without stock payload: preserve existing stock for remaining sizes
        const preservedStock = {};
        for (const s of payload.sizes) {
          if (existingStock[s] !== undefined) {
            preservedStock[s] = existingStock[s];
          } else {
            return ApiResponse.error(
              res,
              `Explicit stock quantity is required for newly added size '${s}'`,
              400
            );
          }
        }
        payload.stock = preservedStock;
      }
    } else {
      // Stock explicitly provided in update: validate all quantities strictly
      if (typeof payload.stock !== "object" || payload.stock === null || Array.isArray(payload.stock)) {
        return ApiResponse.error(res, "Stock must be an object mapping sizes to quantities", 400);
      }

      const targetSizes = payload.sizes || existing.sizes || Object.keys(payload.stock);
      const sanitizedStock = {};

      for (const size of targetSizes) {
        const rawVal = payload.stock[size] !== undefined ? payload.stock[size] : existingStock[size];
        if (rawVal === undefined || rawVal === null || rawVal === "") {
          return ApiResponse.error(res, `Explicit stock quantity is required for size '${size}'`, 400);
        }
        const num = Number(rawVal);
        if (!Number.isInteger(num) || num < 0) {
          return ApiResponse.error(res, `Stock quantity for size '${size}' must be a non-negative integer`, 400);
        }
        sanitizedStock[size] = num;
      }
      payload.stock = sanitizedStock;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, payload, {
      returnDocument: "after",
      runValidators: true,
    });

    return ApiResponse.success(res, "Product updated successfully", product);
  } catch (err) {
    console.error("Update product error:", err.message || "Failed to update product");
    return ApiResponse.error(res, err.message || "Failed to update product", 400);
  }
}

// DELETE /api/products/:id (admin only - soft delete preferred or hard delete if no active orders)
export async function deleteProduct(req, res) {
  try {
    // Soft delete product by setting isActive: false to preserve referential integrity for orders
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { returnDocument: "after" }
    );
    if (!product) return ApiResponse.error(res, "Product not found", 404);

    return ApiResponse.success(res, "Product deactivated successfully", { id: req.params.id });
  } catch (err) {
    console.error("Delete product error:", err.message || "Failed to delete product");
    return ApiResponse.error(res, "Failed to delete product", 500);
  }
}
