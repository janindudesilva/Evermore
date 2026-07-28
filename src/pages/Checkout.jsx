import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Lock, CheckCircle2 } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { user } = useAuth();
  const [mode, setMode] = useState(user ? "account" : "guest");
  const [placed, setPlaced] = useState(false);
  const navigate = useNavigate();

  const shipping = items.length ? 6 : 0;
  const total = subtotal + shipping;

  const handlePlaceOrder = (e) => {
    e.preventDefault();
    // In the real app: POST /api/orders with either the JWT (account)
    // or the guest contact/address fields collected below.
    setPlaced(true);
    clearCart();
  };

  if (placed) {
    return (
      <div className="max-w-lg mx-auto px-6 py-28 text-center">
        <CheckCircle2 size={40} className="mx-auto mb-4 text-moss" />
        <h1 className="font-display text-2xl font-semibold mb-2">Order placed</h1>
        <p className="text-muted mb-6">
          Thanks {mode === "guest" ? "for your order" : `, ${user?.name}`} — a confirmation has been
          sent to your email.
        </p>
        <Link
          to="/shop"
          className="inline-flex bg-moss text-paper px-5 py-3 rounded-full text-sm font-medium hover:bg-moss/90 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    navigate("/cart");
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 pt-10 pb-24 grid md:grid-cols-[1fr_320px] gap-10">
      <div>
        <h1 className="font-display text-3xl font-semibold mb-6">Checkout</h1>

        {!user && (
          <div className="flex gap-2 mb-6 bg-card border border-line rounded-full p-1.5 w-fit">
            <button
              onClick={() => setMode("guest")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                mode === "guest" ? "bg-moss text-paper" : "text-ink-soft"
              }`}
            >
              Guest Checkout
            </button>
            <Link
              to="/sign-in"
              className="px-4 py-1.5 rounded-full text-sm font-medium text-ink-soft hover:text-ink"
            >
              Sign in instead
            </Link>
          </div>
        )}

        {user && (
          <p className="text-sm text-muted mb-6 font-mono-label">
            Checking out as <span className="text-ink">{user.email}</span>
          </p>
        )}

        <form onSubmit={handlePlaceOrder} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name" placeholder="Jane Doe" />
            <Field label="Phone Number" placeholder="+94 71 234 5678" />
          </div>
          {mode === "guest" && !user && <Field label="Email Address" placeholder="jane@example.com" />}
          <Field label="Delivery Address" placeholder="123 Main Street, Colombo" />
          <div className="grid grid-cols-2 gap-4">
            <Field label="City" placeholder="Negombo" />
            <Field label="Postal Code" placeholder="11500" />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Payment</p>
            <div className="bg-card border border-line rounded-xl p-4 flex items-center gap-2 text-sm text-muted">
              <Lock size={14} /> Card details would be collected securely here (Stripe/PayHere integration).
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-moss text-paper rounded-full py-3.5 text-sm font-medium hover:bg-moss/90 transition-colors"
          >
            Place Order — ${total}
          </button>
        </form>
      </div>

      <div className="bg-card border border-line rounded-2xl p-6 h-fit">
        <h3 className="font-medium mb-4">Order Summary</h3>
        <div className="space-y-2 mb-4">
          {items.map((i) => (
            <div key={i.key} className="flex justify-between text-sm">
              <span className="text-ink-soft">
                {i.name} × {i.qty}
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
          <div className="flex justify-between font-medium pt-2">
            <span>Total</span>
            <span className="font-mono-label">${total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder }) {
  return (
    <label className="block">
      <span className="text-sm font-medium mb-1.5 block">{label}</span>
      <input
        required
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
      />
    </label>
  );
}
