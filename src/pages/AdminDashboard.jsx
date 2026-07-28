import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Plus, Package, ShoppingBag, LayoutGrid, Trash2 } from "lucide-react";
import { products as initialProducts } from "../data/products";
import { useAuth } from "../context/AuthContext";
import GarmentIcon from "../components/GarmentIcon";

const mockOrders = [
  { id: "EV-1042", customer: "Nadeesha P.", total: 128, status: "Shipped" },
  { id: "EV-1041", customer: "Guest", total: 64, status: "Pending" },
  { id: "EV-1040", customer: "Kasun R.", total: 214, status: "Delivered" },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("products");
  const [items, setItems] = useState(initialProducts);
  const [form, setForm] = useState({ name: "", price: "", category: "Essentials", type: "tee" });

  if (!user || user.role !== "admin") return <Navigate to="/sign-in" replace />;

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.name || !form.price) return;
    setItems((prev) => [
      {
        id: `evermore-${Date.now()}`,
        name: form.name,
        line: form.category,
        category: form.category,
        tag: "New Arrivals",
        type: form.type,
        color: "#1C1B19",
        price: Number(form.price),
        compareAt: null,
        rating: 5,
        reviews: 0,
        sizes: ["S", "M", "L"],
        description: "",
        features: [],
      },
      ...prev,
    ]);
    setForm({ name: "", price: "", category: "Essentials", type: "tee" });
  };

  const removeItem = (id) => setItems((prev) => prev.filter((p) => p.id !== id));

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-24">
      <p className="font-mono-label text-xs uppercase text-muted mb-1">Admin</p>
      <h1 className="font-display text-3xl font-semibold mb-8">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Stat icon={Package} label="Products Listed" value={items.length} />
        <Stat icon={ShoppingBag} label="Orders This Week" value={mockOrders.length} />
        <Stat icon={LayoutGrid} label="Categories" value={4} />
      </div>

      <div className="flex gap-2 mb-6 bg-card border border-line rounded-full p-1.5 w-fit">
        <TabButton active={tab === "products"} onClick={() => setTab("products")}>
          Products
        </TabButton>
        <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>
          Orders
        </TabButton>
      </div>

      {tab === "products" ? (
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          <div className="bg-card border border-line rounded-2xl overflow-hidden">
            {items.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-0"
              >
                <div className="w-11 h-11 rounded-lg bg-paper border border-line flex items-center justify-center shrink-0">
                  <GarmentIcon type={p.type} color={p.color} className="w-3/4 h-3/4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted">{p.category}</p>
                </div>
                <span className="font-mono-label text-sm">${p.price}</span>
                <button
                  onClick={() => removeItem(p.id)}
                  className="text-muted hover:text-wine transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAdd} className="bg-card border border-line rounded-2xl p-5 h-fit space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Plus size={16} /> List a New Item
            </h3>
            <Field
              label="Name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              placeholder="Wool Overshirt"
            />
            <Field
              label="Price ($)"
              value={form.price}
              onChange={(v) => setForm({ ...form, price: v })}
              placeholder="84"
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
              <span className="text-sm font-medium mb-1.5 block">Type</span>
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
            <button className="w-full bg-moss text-paper rounded-full py-2.5 text-sm font-medium hover:bg-moss/90 transition-colors">
              Add Product
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-card border border-line rounded-2xl overflow-hidden">
          {mockOrders.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between px-5 py-4 border-b border-line last:border-0 text-sm"
            >
              <span className="font-mono-label">{o.id}</span>
              <span className="text-ink-soft">{o.customer}</span>
              <span className="font-mono-label">${o.total}</span>
              <span
                className={`font-mono-label text-xs px-2.5 py-1 rounded-full ${
                  o.status === "Delivered"
                    ? "bg-moss-soft text-moss"
                    : o.status === "Shipped"
                    ? "bg-card border border-line"
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

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-sm font-medium mb-1.5 block">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm"
      />
    </label>
  );
}
