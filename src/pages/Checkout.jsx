import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, CheckCircle2, AlertCircle, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: "",
    email: user?.email || "",
    address: "",
    city: "",
    postalCode: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);

  const shipping = items.length ? 6 : 0;
  const total = subtotal + shipping;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (items.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      const orderItems = items.map((i) => ({
        productId: i.id,
        size: i.size,
        qty: i.qty,
      }));

      let res;
      if (user) {
        // Authenticated checkout
        res = await authFetch("/api/orders", {
          method: "POST",
          body: JSON.stringify({
            items: orderItems,
          }),
        });
      } else {
        // Guest checkout
        res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: orderItems,
            guestInfo: {
              name: formData.name,
              email: formData.email,
              phone: formData.phone,
              address: formData.address,
              city: formData.city,
              postalCode: formData.postalCode,
            },
          }),
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setOrder(data.data);
        clearCart();
      } else {
        throw new Error(data.message || "Failed to place order");
      }
    } catch (err) {
      console.error("Order submission error:", err);
      setError(err.message || "Could not process order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Order Confirmation View
  if (order) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 pb-20 text-center">
        <div className="bg-card border border-line rounded-3xl p-8 sm:p-12 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-moss-soft text-moss flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={36} strokeWidth={2} />
          </div>
          <p className="font-mono-label text-xs uppercase text-muted mb-1">
            Order Confirmation · #{order._id}
          </p>
          <h1 className="font-display text-3xl font-semibold mb-3">Thank you for your order!</h1>
          <p className="text-ink-soft text-sm sm:text-base max-w-md mx-auto mb-8">
            Your order has been placed successfully. A confirmation email has been sent to{" "}
            <span className="font-medium text-ink">
              {order.guestInfo?.email || user?.email || formData.email}
            </span>.
          </p>

          <div className="bg-paper border border-line rounded-2xl p-6 text-left mb-8 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="text-xs font-mono-label uppercase text-muted">Status</span>
              <span className="text-xs font-mono-label bg-moss-soft text-moss px-2.5 py-1 rounded-full uppercase">
                {order.status}
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono-label uppercase text-muted block mb-2">Items Ordered</span>
              {order.items?.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-ink">
                    {item.name} ({item.size}) × {item.qty}
                  </span>
                  <span className="font-mono-label">${item.price * item.qty}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-line pt-3 flex justify-between text-sm font-medium">
              <span>Total Paid</span>
              <span className="font-mono-label text-moss">${order.total}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {user ? (
              <Link
                to="/account"
                className="w-full sm:w-auto bg-moss text-paper px-6 py-3 rounded-full text-sm font-medium hover:bg-moss/90 transition-colors"
              >
                View Order in Account
              </Link>
            ) : (
              <Link
                to="/shop"
                className="w-full sm:w-auto bg-moss text-paper px-6 py-3 rounded-full text-sm font-medium hover:bg-moss/90 transition-colors"
              >
                Continue Shopping
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <ShoppingBag size={40} className="mx-auto mb-4 text-muted" />
        <h2 className="font-display text-2xl font-semibold mb-2">Your cart is empty</h2>
        <p className="text-sm text-muted mb-6">Add garments to your cart before proceeding to checkout.</p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 bg-moss text-paper px-5 py-2.5 rounded-full text-sm font-medium hover:bg-moss/90"
        >
          Shop Collection <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 sm:pb-24 grid md:grid-cols-[1fr_340px] gap-8 md:gap-10">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold mb-6">Checkout</h1>

        {!user && (
          <div className="flex items-center justify-between gap-4 mb-6 bg-card border border-line rounded-2xl p-4">
            <div>
              <p className="text-sm font-medium">Have an account?</p>
              <p className="text-xs text-muted">Sign in for faster checkout and order tracking.</p>
            </div>
            <Link
              to="/sign-in"
              className="px-4 py-1.5 rounded-full text-xs font-medium bg-paper border border-line hover:border-gold shrink-0 transition-colors"
            >
              Sign In
            </Link>
          </div>
        )}

        {user && (
          <div className="mb-6 p-4 bg-card border border-line rounded-2xl">
            <p className="text-xs font-mono-label uppercase text-muted mb-1">Account</p>
            <p className="text-sm font-medium text-ink">
              {user.name} <span className="text-muted font-normal">({user.email})</span>
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-wine-soft text-wine border border-wine/20 rounded-2xl text-sm flex items-center gap-2.5">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handlePlaceOrder} className="space-y-4 sm:space-y-5">
          {!user && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Full Name"
                value={formData.name}
                onChange={(v) => handleChange("name", v)}
                placeholder="Jane Doe"
                required
              />
              <Field
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={(v) => handleChange("email", v)}
                placeholder="jane@example.com"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!user ? (
              <Field
                label="Phone Number"
                value={formData.phone}
                onChange={(v) => handleChange("phone", v)}
                placeholder="+94 71 234 5678"
                required
              />
            ) : (
              <Field
                label="Phone Number"
                value={formData.phone}
                onChange={(v) => handleChange("phone", v)}
                placeholder="+94 71 234 5678"
              />
            )}
            <Field
              label="Delivery Address"
              value={formData.address}
              onChange={(v) => handleChange("address", v)}
              placeholder="123 Main Street"
              required={!user}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="City"
              value={formData.city}
              onChange={(v) => handleChange("city", v)}
              placeholder="Colombo"
              required={!user}
            />
            <Field
              label="Postal Code"
              value={formData.postalCode}
              onChange={(v) => handleChange("postalCode", v)}
              placeholder="00100"
              required={!user}
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Payment</p>
            <div className="bg-card border border-line rounded-2xl p-4 flex items-center gap-3 text-sm text-muted">
              <Lock size={15} className="shrink-0 text-gold" />
              <span>Test Payment: Orders process automatically upon clicking Place Order.</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-moss text-paper rounded-full py-3.5 text-sm font-medium hover:bg-moss/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Processing Order..." : `Place Order — $${total}`}
          </button>
        </form>
      </div>

      <div className="bg-card border border-line rounded-2xl p-6 h-fit">
        <h3 className="font-medium mb-4">Order Summary</h3>
        <div className="space-y-2 mb-4">
          {items.map((i) => (
            <div key={i.key} className="flex justify-between text-sm">
              <span className="text-ink-soft">
                {i.name} ({i.size}) × {i.qty}
              </span>
              <span className="font-mono-label">${i.price * i.qty}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-line pt-4 space-y-2">
          <div className="flex justify-between text-sm text-muted">
            <span>Subtotal</span>
            <span className="font-mono-label">${subtotal}</span>
          </div>
          <div className="flex justify-between text-sm text-muted">
            <span>Shipping</span>
            <span className="font-mono-label">${shipping}</span>
          </div>
          <div className="flex justify-between font-medium pt-2 text-base">
            <span>Total</span>
            <span className="font-mono-label text-moss">${total}</span>
          </div>
        </div>
      </div>
    </div>
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
        className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
      />
    </label>
  );
}
