import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertCircle, ShoppingBag, ArrowRight, Truck } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { fetchJson } from "../utils/api";

function generateUuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Compute deterministic payload fingerprint to detect if checkout payload actually changed
function computeCheckoutFingerprint(items, formData) {
  const itemSummary = (items || [])
    .map((i) => `${i.id || i.productId}:${i.size}:${i.qty}`)
    .sort()
    .join("|");
  const customerSummary = [
    formData.name?.trim().toLowerCase(),
    formData.email?.trim().toLowerCase(),
    formData.phone?.trim(),
    formData.address?.trim().toLowerCase(),
    formData.city?.trim().toLowerCase(),
    formData.postalCode?.trim(),
  ].join("|");
  return `${itemSummary}::${customerSummary}`;
}

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    address: user?.address?.line1 || "",
    city: user?.address?.city || "",
    postalCode: user?.address?.postalCode || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const submittingRef = useRef(false);

  // Aligned shipping rule: $6 flat fee, free over $150
  const shipping = items.length ? (subtotal >= 150 ? 0 : 6) : 0;
  const total = subtotal + shipping;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePlaceOrder = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // Prevent repeated clicks from creating duplicate orders (Task A.4 & A.5)
    if (loading || submittingRef.current || items.length === 0) return;

    // Validate required fields
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setError("Please provide your full name, email, and contact phone number.");
      return;
    }
    if (!formData.address.trim() || !formData.city.trim() || !formData.postalCode.trim()) {
      setError("Please provide a complete delivery address, city, and postal code.");
      return;
    }

    try {
      submittingRef.current = true;
      setLoading(true);
      setError(null);

      const orderItems = items.map((i) => ({
        productId: i.id,
        size: i.size,
        qty: Number(i.qty),
      }));

      // Task A.1 & A.2: Generate/retrieve stable idempotency key for this checkout attempt
      const currentFingerprint = computeCheckoutFingerprint(items, formData);
      let idempotencyKey = null;

      try {
        const storedAttemptRaw = sessionStorage.getItem("evermore_checkout_attempt");
        if (storedAttemptRaw) {
          const stored = JSON.parse(storedAttemptRaw);
          if (stored && stored.key && stored.fingerprint === currentFingerprint) {
            // Reuse identical key for retrying an uncertain request or after page refresh
            idempotencyKey = stored.key;
          }
        }
      } catch (storageErr) {
        // Ignore JSON/sessionStorage parsing issues
      }

      // Task A.3: Generate a new key only when a genuinely new checkout attempt begins
      if (!idempotencyKey) {
        idempotencyKey = generateUuid();
        try {
          sessionStorage.setItem(
            "evermore_checkout_attempt",
            JSON.stringify({ key: idempotencyKey, fingerprint: currentFingerprint })
          );
        } catch (storageErr) {
          // Ignore sessionStorage write issues
        }
      }

      const orderPayload = {
        items: orderItems,
        customer: {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
        },
        shippingAddress: {
          address: formData.address.trim(),
          city: formData.city.trim(),
          postalCode: formData.postalCode.trim(),
          country: "Sri Lanka",
        },
        paymentMethod: "cod",
        idempotencyKey,
      };

      const res = await fetchJson("/api/orders", {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(orderPayload),
      });

      if (res && res.success && res.data) {
        // Success: clear the stored attempt and empty the cart
        try {
          sessionStorage.removeItem("evermore_checkout_attempt");
        } catch (storageErr) {
          // Ignore
        }
        setOrder(res.data);
        clearCart();
      } else {
        throw new Error(res?.message || "Failed to place order.");
      }
    } catch (err) {
      console.error("Order submission failure:", err);
      // Task A.6: Preserve the cart when a request fails; do not clear cart on error
      setError(err.message || "Could not process order. Please check connection and try again.");
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  // Order Confirmation View
  if (order) {
    const orderRef = order.orderNumber || order._id;
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 pb-20 text-center">
        <div className="bg-card border border-line rounded-3xl p-8 sm:p-12 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-moss-soft text-moss flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={36} strokeWidth={2} />
          </div>
          <p className="font-mono-label text-xs uppercase text-muted mb-1">
            Order Confirmed · #{orderRef}
          </p>
          <h1 className="font-display text-3xl font-semibold mb-3">Thank you for your order</h1>
          <p className="text-ink-soft text-sm sm:text-base max-w-md mx-auto mb-8">
            Your order has been recorded in our system. You will receive updates at{" "}
            <span className="font-medium text-ink">
              {order.customer?.email || order.guestInfo?.email || formData.email}
            </span>.
          </p>

          <div className="bg-paper border border-line rounded-2xl p-6 text-left mb-8 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="text-xs font-mono-label uppercase text-muted">Status</span>
              <span className="text-xs font-mono-label bg-moss-soft text-moss px-2.5 py-1 rounded-full uppercase">
                {order.status || "Pending"}
              </span>
            </div>

            <div className="border-b border-line pb-3 text-xs text-muted space-y-1">
              <span className="font-mono-label uppercase block mb-1">Delivery Address</span>
              <p className="text-ink font-medium">
                {order.customer?.name || formData.name} ({order.customer?.phone || formData.phone})
              </p>
              <p>
                {order.shippingAddress?.address || formData.address},{" "}
                {order.shippingAddress?.city || formData.city},{" "}
                {order.shippingAddress?.postalCode || formData.postalCode}
              </p>
            </div>

            <div className="space-y-2 border-b border-line pb-3">
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

            <div className="flex justify-between text-sm text-muted">
              <span>Payment Method</span>
              <span className="font-mono-label uppercase text-ink">Cash on Delivery</span>
            </div>

            <div className="flex justify-between text-sm text-muted">
              <span>Payment Status</span>
              <span className="font-mono-label uppercase text-ink">{order.paymentStatus || "pending"}</span>
            </div>

            <div className="pt-2 flex justify-between text-sm font-medium">
              <span>Total Payable</span>
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
              <p className="text-xs text-muted">Sign in for saved details and order tracking.</p>
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
          <div className="mb-6 p-4 bg-wine-soft text-wine border border-wine/20 rounded-2xl text-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={loading}
              className="shrink-0 px-3 py-1 rounded-full bg-wine text-paper text-xs font-medium hover:bg-wine/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Retrying..." : "Retry"}
            </button>
          </div>
        )}

        <form onSubmit={handlePlaceOrder} className="space-y-4 sm:space-y-5">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Phone Number"
              value={formData.phone}
              onChange={(v) => handleChange("phone", v)}
              placeholder="+94 71 234 5678"
              required
            />
            <Field
              label="Delivery Address"
              value={formData.address}
              onChange={(v) => handleChange("address", v)}
              placeholder="123 Main Street"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="City"
              value={formData.city}
              onChange={(v) => handleChange("city", v)}
              placeholder="Colombo"
              required
            />
            <Field
              label="Postal Code"
              value={formData.postalCode}
              onChange={(v) => handleChange("postalCode", v)}
              placeholder="00100"
              required
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Payment Method</p>
            <div className="bg-card border border-line rounded-2xl p-4 flex items-center gap-3 text-sm">
              <Truck size={18} className="shrink-0 text-moss" />
              <div>
                <span className="font-medium block text-ink">Cash on Delivery (COD)</span>
                <span className="text-xs text-muted">Pay securely in cash when your parcel is delivered.</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-moss text-paper rounded-full py-3.5 text-sm font-medium hover:bg-moss/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Confirming Order..." : `Place Order — $${total}`}
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
            <span className="font-mono-label">{shipping === 0 ? "FREE" : `$${shipping}`}</span>
          </div>
          {shipping === 0 && subtotal >= 150 && (
            <p className="text-[11px] text-moss font-mono-label">✓ Free shipping unlocked (orders over $150)</p>
          )}
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
