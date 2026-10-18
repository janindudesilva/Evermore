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
    const list = [...response.data];
    list.pagination = response.pagination || {
      page: Number(page) || 1,
      limit: Number(limit) || 50,
      total: response.data.length,
      pages: 1,
    };
    return list;
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
 * Submit newsletter subscription to backend with consent.
 */
export async function submitNewsletterApi(email, consent = true) {
  return fetchJson("/api/inquiries/newsletter", {
    method: "POST",
    body: JSON.stringify({ email, consent }),
  });
}

/**
 * Unsubscribe from newsletter.
 */
export async function unsubscribeNewsletterApi(email) {
  return fetchJson("/api/inquiries/newsletter/unsubscribe", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * Fetch inquiries for admin dashboard review.
 */
export async function getInquiriesApi(page = 1, limit = 20, status = "") {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) params.append("status", status);
  return fetchJson(`/api/inquiries?${params.toString()}`);
}

/**
 * Update inquiry status (admin only).
 */
export async function updateInquiryStatusApi(id, status, notes = "") {
  return fetchJson(`/api/inquiries/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, notes }),
  });
}
