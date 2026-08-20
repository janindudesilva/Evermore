import { products as fallbackProducts } from "../data/products";

const BASE_URL = import.meta.env.VITE_API_URL || "";

export async function fetchJson(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, options);

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("API endpoint returned HTML instead of JSON.");
  }

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "API request failed.");
  }

  return data;
}

export async function getProductsApi(cat = "All", query = "") {
  try {
    const params = new URLSearchParams();
    if (cat !== "All") params.append("category", cat);
    if (query.trim()) params.append("q", query.trim());

    const queryString = params.toString() ? `?${params.toString()}` : "";
    const data = await fetchJson(`/api/products${queryString}`);
    if (Array.isArray(data.data) && data.data.length > 0) {
      return data.data;
    }
    // If database has 0 products in category, return filtered static fallback
    return filterFallbackProducts(cat, query);
  } catch (err) {
    console.warn("API fetch failed, falling back to static catalog:", err.message);
    return filterFallbackProducts(cat, query);
  }
}

export async function getProductByIdApi(id) {
  try {
    const data = await fetchJson(`/api/products/${id}`);
    if (data.data) return data.data;
    return getFallbackById(id);
  } catch (err) {
    console.warn(`API fetch failed for product ${id}, falling back to static catalog:`, err.message);
    return getFallbackById(id);
  }
}

function filterFallbackProducts(cat, query) {
  let result = [...fallbackProducts];
  if (cat && cat !== "All") {
    result = result.filter((p) => p.category === cat || p.line === cat || p.tag === cat);
  }
  if (query && query.trim()) {
    const q = query.toLowerCase().trim();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  }
  return result;
}

function getFallbackById(id) {
  const item = fallbackProducts.find((p) => p.id === id || p._id === id);
  if (item) return item;
  // If not found by exact ID, return first fallback item
  return fallbackProducts[0];
}
