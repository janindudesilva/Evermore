import { useState, useEffect, useCallback } from "react";
import { Navigate, Link } from "react-router-dom";
import { LogOut, Package, AlertCircle, MapPin } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchJson } from "../utils/api";

export default function Account() {
  const { user, logout, authFetch, updateProfile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  // Address profile state
  const [addressForm, setAddressForm] = useState({
    line1: user?.address?.line1 || "",
    city: user?.address?.city || "",
    postalCode: user?.address?.postalCode || "",
    phone: user?.phone || "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  const fetchMyOrders = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch("/api/orders/mine");
      const data = await res.json();
      if (res.ok && data.success) {
        // Support both paginated { orders: [...] } and legacy array
        const orderList = Array.isArray(data.data?.orders)
          ? data.data.orders
          : Array.isArray(data.data)
          ? data.data
          : [];
        setOrders(orderList);
      } else {
        throw new Error(data.message || "Failed to load order history");
      }
    } catch (err) {
      console.error("Fetch my orders error:", err);
      setError(err.message || "Could not load order history.");
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  // Hook called unconditionally
  useEffect(() => {
    fetchMyOrders();
  }, [fetchMyOrders]);

  const handleCancelOrder = async (orderId) => {
    if (!confirm("Are you sure you want to cancel this order? This will release reserved stock.")) return;

    try {
      setCancellingId(orderId);
      await fetchJson(`/api/orders/${orderId}/cancel`, {
        method: "POST",
      });
      await fetchMyOrders();
    } catch (err) {
      alert(err.message || "Failed to cancel order.");
    } finally {
      setCancellingId(null);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      await updateProfile({
        phone: addressForm.phone,
        address: {
          line1: addressForm.line1,
          city: addressForm.city,
          postalCode: addressForm.postalCode,
        },
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      alert(err.message || "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  // Guard rendered output conditionally without altering Hook execution order
  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 sm:pb-24">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="font-mono-label text-xs uppercase text-muted mb-1">My Account</p>
          <h1 className="font-display text-3xl font-semibold">Welcome back, {user.name}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-ink-soft hover:text-wine border border-line rounded-full px-4 py-2 transition-colors"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        <div className="md:col-span-1 bg-card border border-line rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={18} className="text-moss" />
            <h3 className="font-medium text-sm">Saved Delivery Details</h3>
          </div>
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">Contact Phone</label>
              <input
                type="text"
                value={addressForm.phone}
                onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                placeholder="+94 71 234 5678"
                className="w-full text-xs rounded-lg border border-line bg-paper px-3 py-2"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Address</label>
              <input
                type="text"
                value={addressForm.line1}
                onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                placeholder="123 Main St"
                className="w-full text-xs rounded-lg border border-line bg-paper px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted block mb-1">City</label>
                <input
                  type="text"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                  placeholder="Colombo"
                  className="w-full text-xs rounded-lg border border-line bg-paper px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Postal Code</label>
                <input
                  type="text"
                  value={addressForm.postalCode}
                  onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                  placeholder="00100"
                  className="w-full text-xs rounded-lg border border-line bg-paper px-3 py-2"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={profileSaving}
              className="w-full bg-paper border border-line rounded-lg py-2 text-xs font-medium hover:border-gold transition-colors disabled:opacity-50"
            >
              {profileSaving ? "Saving..." : profileSuccess ? "Saved ✓" : "Update Details"}
            </button>
          </form>
        </div>

        <div className="md:col-span-2">
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
              <p className="text-sm text-muted mb-5">Once you place an order, it will show up here.</p>
              <Link
                to="/shop"
                className="inline-flex bg-moss text-paper px-5 py-2.5 rounded-full text-sm font-medium hover:bg-moss/90 transition-colors"
              >
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => {
                const orderId = o.orderNumber || o._id;
                const isPending = o.status === "pending";
                const isCancelled = o.status === "cancelled";

                return (
                  <div key={o._id} className="bg-card border border-line rounded-2xl p-5 sm:p-6 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-line pb-3">
                      <div>
                        <span className="font-mono-label text-xs uppercase text-muted block">Order ID</span>
                        <span className="font-mono text-sm font-medium">#{orderId}</span>
                      </div>
                      <div>
                        <span className="font-mono-label text-xs uppercase text-muted block">Date</span>
                        <span className="text-xs text-ink-soft">
                          {new Date(o.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div>
                        <span className="font-mono-label text-xs uppercase text-muted block">Status</span>
                        <span
                          className={`font-mono-label text-xs px-2.5 py-0.5 rounded-full uppercase ${
                            isCancelled
                              ? "bg-wine-soft text-wine"
                              : o.status === "delivered"
                              ? "bg-moss text-paper"
                              : "bg-moss-soft text-moss"
                          }`}
                        >
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
                      <div className="flex items-center gap-2">
                        <span className="text-muted text-xs">
                          Payment: {o.paymentMethod === "cod" ? "Cash on Delivery" : o.paymentMethod} (
                          {o.paymentStatus})
                        </span>
                        {isPending && (
                          <button
                            onClick={() => handleCancelOrder(o._id)}
                            disabled={cancellingId === o._id}
                            className="text-xs text-wine hover:underline ml-2"
                          >
                            {cancellingId === o._id ? "Cancelling..." : "Cancel Order"}
                          </button>
                        )}
                      </div>
                      <div>
                        <span className="text-muted text-xs mr-2">Total</span>
                        <span className="font-mono-label text-moss text-base">${o.total}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
