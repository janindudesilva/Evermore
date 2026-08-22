import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Plus, Package, ShoppingBag, LayoutGrid, Trash2, Edit2, AlertCircle, X, Check, Image, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import GarmentIcon from "../components/GarmentIcon";
import { getProductsApi, fetchJson } from "../utils/api";

const initialMockOrders = [
  { id: "EV-1042", customer: "Nadeesha P.", total: 128, status: "shipped" },
  { id: "EV-1041", customer: "Guest (amaya@example.com)", total: 184, status: "pending" },
  { id: "EV-1040", customer: "Kasun R.", total: 214, status: "delivered" },
];

export default function AdminDashboard() {
  const { user, authFetch } = useAuth();
  const [tab, setTab] = useState("products");
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState(initialMockOrders);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
  });
  const [saving, setSaving] = useState(false);

  if (!user || user.role !== "admin") return <Navigate to="/sign-in" replace />;

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProductsApi();
      setItems(data);
    } catch (err) {
      console.error("Admin fetch items error:", err);
      setError(err.message || "Could not load products.");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await authFetch("/api/orders");
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) return;
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        setOrders(
          data.data.map((o) => ({
            id: `#${o._id}`,
            customer: o.user?.name || o.guestInfo?.name || o.guestInfo?.email || "Guest",
            total: o.total,
            status: o.status || "pending",
          }))
        );
      }
    } catch (err) {
      console.warn("Could not fetch backend orders, using order view fallback:", err.message);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchOrders();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", price: "", category: "Essentials", type: "tee", color: "#1C1B19", description: "", images: "" });
  };

  const startEdit = (product) => {
    const prodId = product._id || product.id;
    setEditingId(prodId);
    setForm({
      name: product.name || "",
      price: product.price ? String(product.price) : "",
      category: product.category || "Essentials",
      type: product.type || "tee",
      color: product.color || "#1C1B19",
      description: product.description || "",
      images: (product.images || []).join("\n"),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price) {
      alert("Name and Price are required.");
      return;
    }

    try {
      setSaving(true);
      const imageUrls = form.images
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.length > 0);
      const payload = {
        name: form.name,
        line: form.category,
        category: form.category,
        type: form.type,
        color: form.color,
        price: Number(form.price),
        description: form.description || `${form.name} in ${form.category}`,
        images: imageUrls,
      };

      if (editingId) {
        // PUT /api/products/:id (Update)
        try {
          const res = await authFetch(`/api/products/${editingId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          });
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await res.json();
            if (res.ok && data.success) {
              setItems((prev) => prev.map((p) => ((p._id || p.id) === editingId ? data.data : p)));
              resetForm();
              return;
            }
          }
        } catch (err) {
          console.warn("Backend update failed, applying local edit fallback");
        }

        // Static fallback edit
        setItems((prev) =>
          prev.map((p) =>
            (p._id || p.id) === editingId ? { ...p, ...payload, id: editingId } : p
          )
        );
        resetForm();
      } else {
        // POST /api/products (Create)
        const newId = `evermore-${Date.now()}`;
        const newProduct = {
          _id: newId,
          id: newId,
          ...payload,
          tag: "New Arrivals",
          sizes: ["S", "M", "L"],
          features: ["Natural fibers", "Crafted construction"],
          images: imageUrls,
        };

        try {
          const res = await authFetch("/api/products", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) {
            const data = await res.json();
            if (res.ok && data.success) {
              setItems((prev) => [data.data, ...prev]);
              resetForm();
              return;
            }
          }
        } catch (err) {
          console.warn("Backend create failed, applying local create fallback");
        }

        // Static fallback create
        setItems((prev) => [newProduct, ...prev]);
        resetForm();
      }
    } catch (err) {
      console.error("Save product error:", err);
      alert(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (id) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await authFetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        if (!res.ok || !data.success) {
          console.warn("Backend delete warning:", data.message);
        }
      }
    } catch (err) {
      console.warn("Delete product backend request warning:", err.message);
    }

    setItems((prev) => prev.filter((p) => (p._id || p.id) !== id));
    if (editingId === id) resetForm();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 sm:pb-24">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="font-mono-label text-xs uppercase text-muted mb-1">Admin Panel</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold">Product & Store Dashboard</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
        <Stat icon={Package} label="Products Listed" value={items.length} />
        <Stat icon={ShoppingBag} label="Orders This Week" value={orders.length} />
        <Stat icon={LayoutGrid} label="Categories" value={4} />
      </div>

      <div className="flex gap-2 mb-6 bg-card border border-line rounded-full p-1.5 w-fit">
        <TabButton active={tab === "products"} onClick={() => setTab("products")}>
          Products CRUD
        </TabButton>
        <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>
          Orders ({orders.length})
        </TabButton>
      </div>

      {tab === "products" ? (
        <div className="grid md:grid-cols-[1fr_340px] gap-6">
          <div className="bg-card border border-line rounded-2xl overflow-hidden">
            <div className="p-4 bg-paper/50 border-b border-line flex items-center justify-between">
              <h3 className="font-medium text-sm">All Garments ({items.length})</h3>
              <button
                onClick={fetchItems}
                className="text-xs text-muted hover:text-ink transition-colors flex items-center gap-1"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-muted text-sm">Loading products...</div>
            ) : error ? (
              <div className="p-6 text-center text-wine text-sm flex flex-col items-center gap-2">
                <AlertCircle size={20} />
                <span>{error}</span>
                <button onClick={fetchItems} className="underline text-xs">Retry</button>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-muted text-sm">No products found.</div>
            ) : (
              items.map((p) => {
                const prodId = p._id || p.id;
                const isEditing = editingId === prodId;
                const hasImage = p.images && p.images.length > 0;
                return (
                  <div
                    key={prodId}
                    className={`flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 border-b border-line last:border-0 transition-colors ${
                      isEditing ? "bg-moss-soft/40" : ""
                    }`}
                  >
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-paper border border-line flex items-center justify-center shrink-0 overflow-hidden">
                      {hasImage ? (
                        <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <GarmentIcon type={p.type || "jacket"} color={p.color || "#1C1B19"} className="w-3/4 h-3/4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted">
                        {p.category} · <span className="font-mono">{p.type}</span>
                      </p>
                    </div>
                    <span className="font-mono-label text-sm shrink-0">${p.price}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => startEdit(p)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isEditing
                            ? "bg-moss text-paper border-moss"
                            : "text-muted hover:text-ink border-transparent hover:border-line"
                        }`}
                        title="Edit Product"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => removeItem(prodId)}
                        className="p-1.5 rounded-lg text-muted hover:text-wine border border-transparent hover:border-wine/20 transition-colors"
                        title="Delete Product"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form onSubmit={handleSubmit} className="bg-card border border-line rounded-2xl p-5 h-fit space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2 text-sm sm:text-base">
                {editingId ? <Edit2 size={16} className="text-gold" /> : <Plus size={16} />}
                {editingId ? "Edit Product" : "List New Item"}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-muted hover:text-ink flex items-center gap-1"
                >
                  <X size={12} /> Cancel
                </button>
              )}
            </div>

            <Field
              label="Product Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="e.g. Wool Overshirt"
              required
            />
            <Field
              label="Price ($)"
              type="number"
              value={form.price}
              onChange={(v) => setForm({ ...form, price: v })}
              placeholder="84"
              required
            />
            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Category</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
              >
                {["Essentials", "Outerwear", "New Arrivals", "Featured"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Garment Type</span>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
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
            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Product description..."
                rows={2}
                className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Image size={14} className="text-gold" /> Product Images
              </span>
              <p className="text-xs text-muted mb-1.5">Paste image URLs — one per line.</p>
              <textarea
                value={form.images}
                onChange={(e) => setForm({ ...form, images: e.target.value })}
                placeholder={"https://example.com/front.jpg\nhttps://example.com/back.jpg"}
                rows={3}
                className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-mono text-xs"
              />
            </label>

            {form.images.trim() && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {form.images
                  .split("\n")
                  .map((u) => u.trim())
                  .filter((u) => u.length > 0)
                  .map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Preview ${idx + 1}`}
                      className="w-16 h-16 rounded-lg border border-line object-cover shrink-0 bg-paper"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ))}
              </div>
            )}

            <button
              disabled={saving}
              className="w-full bg-moss text-paper rounded-full py-2.5 text-sm font-medium hover:bg-moss/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? "Saving..." : editingId ? "Update Product" : "Create Product"}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-card border border-line rounded-2xl overflow-hidden">
          <div className="p-4 bg-paper/50 border-b border-line flex items-center justify-between">
            <h3 className="font-medium text-sm">Recent Store Orders ({orders.length})</h3>
            <button
              onClick={fetchOrders}
              className="text-xs text-muted hover:text-ink transition-colors flex items-center gap-1"
            >
              <RefreshCw size={12} /> Refresh Orders
            </button>
          </div>
          {orders.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between px-5 py-4 border-b border-line last:border-0 text-sm"
            >
              <span className="font-mono-label">{o.id}</span>
              <span className="text-ink-soft">{o.customer}</span>
              <span className="font-mono-label">${o.total}</span>
              <span
                className={`font-mono-label text-xs px-2.5 py-1 rounded-full uppercase ${
                  o.status === "delivered" || o.status === "Delivered"
                    ? "bg-moss-soft text-moss"
                    : o.status === "shipped" || o.status === "Shipped"
                    ? "bg-card border border-line text-ink"
                    : "bg-wine-soft text-wine"
                }`}
              >
                {o.status}
              </span>
            </div>
          ))}
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
        active ? "bg-moss text-paper" : "text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", required = false }) {
  return (
    <label className="block">
      <span className="text-sm font-medium mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
      />
    </label>
  );
}
