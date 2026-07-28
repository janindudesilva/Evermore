import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, X, ArrowRight, ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";
import GarmentIcon from "../components/GarmentIcon";

export default function Cart() {
  const { items, updateQty, removeItem, subtotal } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-24 text-center">
        <span className="w-16 h-16 rounded-full bg-card border border-line flex items-center justify-center mx-auto mb-5">
          <ShoppingBag size={22} strokeWidth={1.5} />
        </span>
        <h1 className="font-display text-2xl font-semibold mb-2">Your cart is empty</h1>
        <p className="text-muted mb-6">Nothing here yet — go find something to wear.</p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 bg-moss text-paper px-5 py-3 rounded-full text-sm font-medium hover:bg-moss/90 transition-colors"
        >
          Browse the Collection <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 sm:pb-24">
      <h1 className="font-display text-2xl sm:text-3xl font-semibold mb-6 sm:mb-8">Your Cart</h1>
      <div className="space-y-4 mb-8">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-card border border-line rounded-2xl p-4"
          >
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-paper border border-line flex items-center justify-center shrink-0">
                <GarmentIcon type={item.type} color={item.color} className="w-3/4 h-3/4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm sm:text-base">{item.name}</p>
                <p className="text-xs text-muted font-mono-label">Size {item.size}</p>
              </div>
              <button
                onClick={() => removeItem(item.key)}
                className="sm:hidden text-muted hover:text-wine transition-colors p-1"
                aria-label="Remove item"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center justify-between w-full sm:w-auto sm:ml-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-line/60">
              <div className="flex items-center gap-2 bg-paper border border-line rounded-full px-2.5 py-1">
                <button onClick={() => updateQty(item.key, item.qty - 1)} className="p-1">
                  <Minus size={12} />
                </button>
                <span className="font-mono-label text-sm w-4 text-center">{item.qty}</span>
                <button onClick={() => updateQty(item.key, item.qty + 1)} className="p-1">
                  <Plus size={12} />
                </button>
              </div>
              <p className="font-mono-label text-sm sm:text-base w-16 text-right">${item.price * item.qty}</p>
              <button
                onClick={() => removeItem(item.key)}
                className="hidden sm:block text-muted hover:text-wine transition-colors"
                aria-label="Remove item"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-line rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs sm:text-sm text-muted">Subtotal</p>
          <p className="font-mono-label text-xl sm:text-2xl">${subtotal}</p>
        </div>
        <button
          onClick={() => navigate("/checkout")}
          className="flex items-center justify-center gap-2 bg-moss text-paper px-6 py-3.5 rounded-full text-sm font-medium hover:bg-moss/90 transition-colors"
        >
          Checkout <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
