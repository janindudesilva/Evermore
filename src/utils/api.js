export const BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Centralized fetch helper for the EVERMORE platform.
 * Automatically respects VITE_API_URL, attaches JWT headers,
 * enforces JSON responses, and fails explicitly without mock fallbacks.
 */
export async function fetchJson(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = localStorage.getItem("token");

  const headers = {
    Accept: "application/json",
    ...options.headers,
  };

  // If request sends a body and Content-Type not explicitly set or FormData, default to JSON
  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  // Automatically attach JWT token if present in localStorage
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `API service unavailable or returned non-JSON response (${res.status} ${res.statusText}). Please check that the backend server is running.`
    );
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new Error("Failed to parse JSON response from server.");
  }

  if (!res.ok || data.success === false) {
    // If token expired / unauthorized, clear stale token
    if (res.status === 401) {
      localStorage.removeItem("token");
    }
    throw new Error(data?.message || `Request failed with status ${res.status}`);
  }

  return data;
}

/**
 * Raw authorized fetch client preserving the Response object
 * while ensuring BASE_URL and Bearer token are attached.
 */
export async function apiFetch(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = localStorage.getItem("token");

  const headers = {
    Accept: "application/json",
    ...options.headers,
  };

  if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}

/**
 * Fetch products from the active database.
 * Never silently substitutes mock static products in production.
 */
export async function getProductsApi(cat = "All", query = "", page = 1, limit = 50) {
  const params = new URLSearchParams();
  if (cat && cat !== "All") params.append("category", cat);
  if (query && query.trim()) params.append("q", query.trim());
  if (page) params.append("page", String(page));
  if (limit) params.append("limit", String(limit));

  const queryString = params.toString() ? `?${params.toString()}` : "";
  const response = await fetchJson(`/api/products${queryString}`);

  if (Array.isArray(response.data)) {
    return response.data;
  }
  return [];
}

/**
 * Fetch a single product by ID from the active database.
 * Throws when not found rather than returning unrelated fallback products.
 */
export async function getProductByIdApi(id) {
  if (!id) throw new Error("Product ID is required");
  const response = await fetchJson(`/api/products/${id}`);
  if (response.data) {
    return response.data;
  }
  throw new Error("Product not found");
}

/**
 * Submit contact inquiry to backend.
 */
export async function submitContactApi(formData) {
  return fetchJson("/api/inquiries/contact", {
    method: "POST",
    body: JSON.stringify(formData),
  });
}

/**
 * Submit newsletter subscription to backend.
 */
export async function submitNewsletterApi(email) {
  return fetchJson("/api/inquiries/newsletter", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
