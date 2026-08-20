import { useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { LogOut, Package, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Account() {
  const { user, logout, authFetch } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  if (!user) return <Navigate to="/sign-in" replace />;

  useEffect(() => {
    async function fetchMyOrders() {
      try {
        setLoading(true);
        setError(null);
        const res = await authFetch("/api/orders/mine");
        const data = await res.json();
        if (res.ok && data.success) {
          setOrders(data.data);
        } else {
          throw new Error(data.message || "Failed to load order history");
        }
      } catch (err) {
        console.error("Fetch my orders error:", err);
        setError(err.message || "Could not load order history.");
      } finally {
        setLoading(false);
      }
    }

    fetchMyOrders();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 sm:pb-24">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="font-mono-label text-xs uppercase text-muted mb-1">My Account</p>
          <h1 className="font-display text-3xl font-semibold">Welcome back, {user.name}</h1>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-ink-soft hover:text-wine border border-line rounded-full px-4 py-2 transition-colors"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>

      <div className="mb-6">
        <h2 className="font-display text-xl font-semibold mb-4">Order History</h2>
        {loading ? (
          <div className="bg-card border border-line rounded-2xl p-8 text-center text-muted text-sm">
            Loading your orders...
          </div>
        ) : error ? (
          <div className="bg-wine-soft text-wine border border-wine/20 rounded-2xl p-6 text-center text-sm flex flex-col items-center gap-2">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-card border border-line rounded-2xl p-8 text-center">
            <span className="w-12 h-12 rounded-full bg-paper border border-line flex items-center justify-center mx-auto mb-4">
              <Package size={20} strokeWidth={1.75} />
            </span>
            <p className="font-medium mb-1">No orders yet</p>
            <p className="text-sm text-muted mb-5">Once you place an order, it'll show up here.</p>
            <Link
              to="/shop"
              className="inline-flex bg-moss text-paper px-5 py-2.5 rounded-full text-sm font-medium hover:bg-moss/90 transition-colors"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div key={o._id} className="bg-card border border-line rounded-2xl p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2 border-b border-line pb-3">
                  <div>
                    <span className="font-mono-label text-xs uppercase text-muted block">Order ID</span>
                    <span className="font-mono text-sm font-medium">#{o._id}</span>
                  </div>
                  <div>
                    <span className="font-mono-label text-xs uppercase text-muted block">Date</span>
                    <span className="text-xs text-ink-soft">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono-label text-xs uppercase text-muted block">Status</span>
                    <span className="font-mono-label text-xs bg-moss-soft text-moss px-2.5 py-0.5 rounded-full uppercase">
                      {o.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  {o.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-ink-soft">
                        {item.name} ({item.size}) × {item.qty}
                      </span>
                      <span className="font-mono-label">${item.price * item.qty}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-line pt-3 flex justify-between items-center text-sm font-medium">
                  <span>Total Paid</span>
                  <span className="font-mono-label text-moss text-base">${o.total}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
