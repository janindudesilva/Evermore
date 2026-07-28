import Product from "../models/Product.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// GET /api/products?category=Essentials&q=jacket
export async function getProducts(req, res) {
  try {
    const { category, q } = req.query;
    const filter = { isActive: true };
    if (category && category !== "All") filter.category = category;
    if (q) filter.$text = { $search: q };

    const products = await Product.find(filter).sort({ createdAt: -1 });
    return ApiResponse.success(res, "Products fetched", products);
  } catch (err) {
    return ApiResponse.error(res, err.message, 500);
  }
}

// GET /api/products/:id
export async function getProductById(req, res) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return ApiResponse.error(res, "Product not found", 404);
    return ApiResponse.success(res, "Product fetched", product);
  } catch (err) {
    return ApiResponse.error(res, "Product not found", 404);
  }
}

// POST /api/products  (admin only)
export async function createProduct(req, res) {
  try {
    const product = await Product.create(req.body);
    return ApiResponse.success(res, "Product created", product, 201);
  } catch (err) {
    return ApiResponse.error(res, err.message, 400);
  }
}

// PUT /api/products/:id  (admin only)
export async function updateProduct(req, res) {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!product) return ApiResponse.error(res, "Product not found", 404);
    return ApiResponse.success(res, "Product updated", product);
  } catch (err) {
    return ApiResponse.error(res, err.message, 400);
  }
}

// DELETE /api/products/:id  (admin only)
export async function deleteProduct(req, res) {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return ApiResponse.error(res, "Product not found", 404);
    return ApiResponse.success(res, "Product deleted");
  } catch (err) {
    return ApiResponse.error(res, err.message, 500);
  }
}
