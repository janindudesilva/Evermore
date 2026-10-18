import { createContext, useContext, useMemo, useState, useEffect } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem("evermore_cart");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Persist cart to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("evermore_cart", JSON.stringify(items));
    } catch (e) {
      console.warn("Could not persist cart to localStorage:", e);
    }
  }, [items]);

  const addItem = (product, size, qty = 1) => {
    const prodId = product._id || product.id;
    const requestedQty = Math.max(1, parseInt(qty) || 1);

    const rawStock = product.stock instanceof Map
      ? Object.fromEntries(product.stock)
      : (product.stock || {});

    // Respect real inventory: if size has 0 stock, do not allow adding phantom units
    const sizeStock = rawStock[size] !== undefined ? Number(rawStock[size]) : 0;
    if (sizeStock <= 0) {
      return false;
    }

    setItems((prev) => {
      const key = `${prodId}-${size}`;
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        const cappedQty = Math.min(sizeStock, existing.qty + requestedQty);
        return prev.map((i) => (i.key === key ? { ...i, qty: cappedQty, maxStock: sizeStock } : i));
      }
      return [
        ...prev,
        {
          key,
          id: prodId,
          name: product.name,
          price: product.price,
          type: product.type,
          color: product.color,
          size,
          qty: Math.min(sizeStock, requestedQty),
          maxStock: sizeStock,
        },
      ];
    });
    return true;
  };

  const updateQty = (key, qty) => {
    const parsed = parseInt(qty) || 0;
    setItems((prev) => {
      if (parsed <= 0) {
        return prev.filter((i) => i.key !== key);
      }
      return prev.map((i) => {
        if (i.key !== key) return i;
        const max = i.maxStock || 50;
        return { ...i, qty: Math.min(max, parsed) };
      });
    });
  };

  const removeItem = (key) => setItems((prev) => prev.filter((i) => i.key !== key));
  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem("evermore_cart");
    } catch (e) {
      // Ignore
    }
  };

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + Math.round(i.price * i.qty * 100) / 100, 0),
    [items]
  );
  const count = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);

  return (
    <CartContext.Provider value={{ items, addItem, updateQty, removeItem, clearCart, subtotal, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
