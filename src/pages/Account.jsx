import { Navigate, Link } from "react-router-dom";
import { LogOut, Package } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Account() {
  const { user, logout } = useAuth();
  if (!user) return <Navigate to="/sign-in" replace />;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 sm:pb-24">
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
    </div>
  );
}
