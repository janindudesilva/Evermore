import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { Plus, Package, ShoppingBag, LayoutGrid, Trash2, Edit2, AlertCircle, X, Image, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import GarmentIcon from "../components/GarmentIcon";
import { getProductsApi, fetchJson } from "../utils/api";

const ALL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export default function AdminDashboard() {
  const { user, authFetch } = useAuth();
  const [tab, setTab] = useState("products");
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ordersError, setOrdersError] = useState(null);

  // Form states
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    price: "",
    category: "Essentials",
    type: "tee",
    color: "#1C1B19",
    description: "",
    images: "",
    sizes: ["S", "M", "L"],
    stock: { S: 10, M: 10, L: 10 },
  });
  const [saving, setSaving] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProductsApi();
      setItems(data);
    } catch (err) {
      console.error("Admin fetch items error:", err);
      setError(err.message || "Could not load products from server.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      setOrdersError(null);
      const res = await authFetch("/api/orders");
      const data = await res.json();
      if (res.ok && data.success) {
        const orderList = Array.isArray(data.data?.orders)
          ? data.data.orders
          : Array.isArray(data.data)
          ? data.data
          : [];

        setOrders(
          orderList.map((o) => ({
            rawId: o._id,
            id: o.orderNumber ? `#${o.orderNumber}` : `#${o._id}`,
            customer: o.customer?.name || o.user?.name || o.guestInfo?.name || "Customer",
            email: o.customer?.email || o.guestInfo?.email || "",
            total: o.total,
            status: o.status || "pending",
            paymentMethod: o.paymentMethod || "cod",
            paymentStatus: o.paymentStatus || "pending",
          }))
        );
      } else {
        throw new Error(data.message || "Failed to load orders");
      }
    } catch (err) {
      console.error("Admin fetch orders error:", err);
      setOrdersError(err.message || "Could not fetch orders from server.");
    } finally {
      setOrdersLoading(false);
    }
  }, [authFetch]);

  // Unconditional hook invocations
  useEffect(() => {
    if (user && user.role === "admin") {
      fetchItems();
      fetchOrders();
    }
  }, [user, fetchItems, fetchOrders]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: "",
      price: "",
      category: "Essentials",
      type: "tee",
      color: "#1C1B19",
      description: "",
      images: "",
      sizes: ["S", "M", "L"],
      stock: { S: 10, M: 10, L: 10 },
    });
  };

  const startEdit = (product) => {
    const prodId = product._id || product.id;
    setEditingId(prodId);

    const productSizes = Array.isArray(product.sizes) && product.sizes.length > 0
      ? product.sizes
      : ["S", "M", "L"];

    const rawStock = product.stock || {};
    const stockMap = {};
    for (const s of productSizes) {
      stockMap[s] = rawStock[s] !== undefined ? rawStock[s] : 10;
    }

    setForm({
      name: product.name || "",
      price: product.price !== undefined ? String(product.price) : "",
      category: product.category || "Essentials",
      type: product.type || "tee",
      color: product.color || "#1C1B19",
      description: product.description || "",
      images: (product.images || []).join("\n"),
      sizes: productSizes,
      stock: stockMap,
    });
  };

  const toggleSize = (size) => {
    setForm((prev) => {
      const exists = prev.sizes.includes(size);
      const newSizes = exists ? prev.sizes.filter((s) => s !== size) : [...prev.sizes, size];
      const newStock = { ...prev.stock };
      if (!exists && newStock[size] === undefined) {
        newStock[size] = 10;
      }
      return { ...prev, sizes: newSizes, stock: newStock };
    });
  };

  const handleStockChange = (size, qty) => {
    const parsed = Math.max(0, parseInt(qty) || 0);
    setForm((prev) => ({
      ...prev,
      stock: { ...prev.stock, [size]: parsed },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) {
      alert("Name and Price are required.");
      return;
    }
    if (form.sizes.length === 0) {
      alert("Please select at least one available size.");
      return;
    }

    try {
      setSaving(true);
      const imageUrls = form.images
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.length > 0);

      const stockPayload = {};
      for (const size of form.sizes) {
        stockPayload[size] = form.stock[size] !== undefined ? form.stock[size] : 10;
      }

      const payload = {
        name: form.name.trim(),
        line: form.category,
        category: form.category,
        type: form.type,
        color: form.color,
        price: Number(form.price),
        description: form.description || `${form.name} in ${form.category}`,
        images: imageUrls,
        sizes: form.sizes,
        stock: stockPayload,
      };

      if (editingId) {
        // PUT /api/products/:id
        const res = await fetchJson(`/api/products/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        if (res.success && res.data) {
          setItems((prev) => prev.map((p) => ((p._id || p.id) === editingId ? res.data : p)));
          resetForm();
        } else {
          throw new Error(res.message || "Failed to update product.");
        }
      } else {
        // POST /api/products
        const res = await fetchJson("/api/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (res.success && res.data) {
          setItems((prev) => [res.data, ...prev]);
          resetForm();
        } else {
          throw new Error(res.message || "Failed to create product.");
        }
      }
    } catch (err) {
      console.error("Save product error:", err);
      // Explicitly alert error without simulating fake success (E-08)
      alert(err.message || "Failed to save product to database.");
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (id) => {
    if (!confirm("Are you sure you want to deactivate this product?")) return;
    try {
      const res = await fetchJson(`/api/products/${id}`, {
        method: "DELETE",
      });
      if (res.success) {
        setItems((prev) => prev.filter((p) => (p._id || p.id) !== id));
        if (editingId === id) resetForm();
      } else {
        throw new Error(res.message || "Failed to deactivate product.");
      }
    } catch (err) {
      console.error("Delete product error:", err);
      alert(err.message || "Failed to delete product from server.");
    }
  };

  const handleStatusChange = async (rawId, newStatus) => {
    try {
      setUpdatingOrderId(rawId);
      const res = await fetchJson(`/api/orders/${rawId}/status`, {
        method: "PUT",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.success && res.data) {
        await fetchOrders();
      } else {
        throw new Error(res.message || "Failed to update status");
      }
    } catch (err) {
      alert(err.message || "Failed to transition order status.");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Safe render guard after all Hooks
  if (!user || user.role !== "admin") {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 sm:pb-24">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="font-mono-label text-xs uppercase text-muted mb-1">Admin Panel</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">Store Management</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <Stat icon={Package} label="Active Products" value={items.length} />
        <Stat icon={ShoppingBag} label="Orders Recorded" value={orders.length} />
        <Stat icon={LayoutGrid} label="Categories" value={4} />
      </div>

      <div className="flex gap-2 mb-6 bg-card border border-line rounded-full p-1.5 w-fit">
        <TabButton active={tab === "products"} onClick={() => setTab("products")}>
          Products ({items.length})
        </TabButton>
        <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>
          Orders ({orders.length})
        </TabButton>
      </div>

      {tab === "products" ? (
        <div className="grid md:grid-cols-[1fr_360px] gap-6">
          <div className="bg-card border border-line rounded-2xl overflow-hidden">
            <div className="p-4 bg-paper/50 border-b border-line flex items-center justify-between">
              <h3 className="font-medium text-sm">Catalog Garments ({items.length})</h3>
              <button
                onClick={fetchItems}
                className="text-xs text-muted hover:text-ink transition-colors flex items-center gap-1"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {error && (
              <div className="p-4 bg-wine-soft text-wine text-xs border-b border-line flex items-center gap-2">
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="p-8 text-center text-muted text-sm">Loading products...</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-muted text-sm">No products found in database.</div>
            ) : (
              <div className="divide-y divide-line">
                {items.map((p) => {
                  const prodId = p._id || p.id;
                  const hasImage = p.images && p.images.length > 0;
                  return (
                    <div key={prodId} className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-paper border border-line flex items-center justify-center overflow-hidden shrink-0">
                          {hasImage ? (
                            <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <GarmentIcon type={p.type || "jacket"} color={p.color || "#1C1B19"} className="w-8 h-8" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-ink">{p.name}</p>
                          <p className="text-xs text-muted">
                            {p.category} · ${p.price} · Sizes: {(p.sizes || []).join(", ") || "None"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(p)}
                          className="p-1.5 rounded-lg border border-line text-ink-soft hover:text-ink hover:border-gold transition-colors"
                          title="Edit Product"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => removeItem(prodId)}
                          className="p-1.5 rounded-lg border border-line text-ink-soft hover:text-wine hover:border-wine/50 transition-colors"
                          title="Deactivate Product"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Create / Edit Form */}
          <div className="bg-card border border-line rounded-2xl p-5 h-fit">
            <div className="flex items-center justify-between mb-4 border-b border-line pb-3">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <Plus size={16} className="text-gold" />
                {editingId ? "Edit Garment" : "Add New Garment"}
              </h3>
              {editingId && (
                <button onClick={resetForm} className="text-xs text-muted hover:text-ink flex items-center gap-1">
                  <X size={12} /> Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <Field
                label="Garment Name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="e.g. Linen Work Jacket"
                required
              />

              <Field
                label="Price (USD)"
                type="number"
                value={form.price}
                onChange={(v) => setForm({ ...form, price: v })}
                placeholder="128"
                required
              />

              <label className="block">
                <span className="text-xs font-medium mb-1 block">Category</span>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs"
                >
                  {["Essentials", "Outerwear", "New Arrivals", "Featured"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-medium mb-1 block">Garment Type</span>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs"
                >
                  {["tee", "shirt", "jacket", "trousers", "dress", "skirt"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>

              <Field
                label="Color Hex"
                value={form.color}
                onChange={(v) => setForm({ ...form, color: v })}
                placeholder="#1C1B19"
              />

              {/* Sizes and Stock Management (E-11) */}
              <div>
                <span className="text-xs font-medium mb-1.5 block">Sizes & Stock</span>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ALL_SIZES.map((sz) => {
                    const active = form.sizes.includes(sz);
                    return (
                      <button
                        type="button"
                        key={sz}
                        onClick={() => toggleSize(sz)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono-label border transition-colors ${
                          active ? "bg-moss text-paper border-moss" : "bg-paper border-line text-muted"
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>

                {form.sizes.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 bg-paper/60 p-2.5 rounded-xl border border-line">
                    {form.sizes.map((sz) => (
                      <div key={sz}>
                        <span className="text-[10px] font-mono-label text-muted block">{sz} Stock:</span>
                        <input
                          type="number"
                          min="0"
                          value={form.stock[sz] !== undefined ? form.stock[sz] : 10}
                          onChange={(e) => handleStockChange(sz, e.target.value)}
                          className="w-full text-xs rounded border border-line bg-paper px-2 py-1"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="block">
                <span className="text-xs font-medium mb-1 block">Description</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Material, weave, and silhouette details..."
                  rows={2}
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium mb-1 flex items-center gap-1.5">
                  <Image size={13} className="text-gold" /> Image URLs
                </span>
                <textarea
                  value={form.images}
                  onChange={(e) => setForm({ ...form, images: e.target.value })}
                  placeholder="https://example.com/item.jpg"
                  rows={2}
                  className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs font-mono"
                />
              </label>

              <button
                disabled={saving}
                className="w-full bg-moss text-paper rounded-full py-2.5 text-xs font-medium hover:bg-moss/90 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving to Database..." : editingId ? "Update Product" : "Create Product"}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-line rounded-2xl overflow-hidden">
          <div className="p-4 bg-paper/50 border-b border-line flex items-center justify-between">
            <h3 className="font-medium text-sm">All Customer Orders ({orders.length})</h3>
            <button
              onClick={fetchOrders}
              className="text-xs text-muted hover:text-ink transition-colors flex items-center gap-1"
            >
              <RefreshCw size={12} /> Refresh Orders
            </button>
          </div>

          {ordersError && (
            <div className="p-4 bg-wine-soft text-wine text-xs border-b border-line flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{ordersError}</span>
            </div>
          )}

          {ordersLoading ? (
            <div className="p-8 text-center text-muted text-sm">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-muted text-sm">No customer orders recorded yet.</div>
          ) : (
            <div className="divide-y divide-line">
              {orders.map((o) => (
                <div
                  key={o.rawId}
                  className="flex items-center justify-between px-5 py-4 text-sm flex-wrap gap-3"
                >
                  <div>
                    <span className="font-mono-label block text-xs font-semibold text-ink">{o.id}</span>
                    <span className="text-xs text-muted">{o.customer} ({o.email || "No email"})</span>
                  </div>
                  <div>
                    <span className="font-mono-label text-moss block font-medium">${o.total}</span>
                    <span className="text-[11px] text-muted uppercase font-mono-label">
                      {o.paymentMethod} · {o.paymentStatus}
                    </span>
                  </div>

                  {/* Order Status Transition Control (E-09) */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Status:</span>
                    <select
                      value={o.status}
                      disabled={updatingOrderId === o.rawId || o.status === "cancelled" || o.status === "delivered"}
                      onChange={(e) => handleStatusChange(o.rawId, e.target.value)}
                      className="text-xs rounded-lg border border-line bg-paper px-2.5 py-1 font-mono-label uppercase"
                    >
                      <option value={o.status}>{o.status}</option>
                      {o.status === "pending" && <option value="confirmed">confirmed</option>}
                      {o.status === "pending" && <option value="cancelled">cancelled</option>}
                      {o.status === "confirmed" && <option value="processing">processing</option>}
                      {o.status === "confirmed" && <option value="cancelled">cancelled</option>}
                      {o.status === "processing" && <option value="packed">packed</option>}
                      {o.status === "processing" && <option value="cancelled">cancelled</option>}
                      {o.status === "packed" && <option value="shipped">shipped</option>}
                      {o.status === "packed" && <option value="cancelled">cancelled</option>}
                      {o.status === "shipped" && <option value="delivered">delivered</option>}
                      {o.status === "shipped" && <option value="cancelled">cancelled</option>}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="bg-card border border-line rounded-2xl p-5 flex items-center gap-3">
      <span className="w-10 h-10 rounded-full bg-paper border border-line flex items-center justify-center">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <div>
        <p className="font-mono-label text-xl leading-tight">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active ? "bg-moss text-paper" : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required = false }) {
  return (
    <label className="block">
      <span className="text-xs font-medium mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-xs"
      />
    </label>
  );
}
