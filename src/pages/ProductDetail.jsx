import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Minus, Plus, ShieldCheck, Truck, RefreshCcw, Heart, Star, AlertCircle } from "lucide-react";
import GarmentIcon from "../components/GarmentIcon";
import { useCart } from "../context/CartContext";
import { getProductByIdApi } from "../utils/api";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedImage, setSelectedImage] = useState(0);
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const { addItem } = useCart();

  // Wishlist initialization
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("evermore_wishlist") || "[]");
      if (Array.isArray(saved) && id) {
        setIsWishlisted(saved.includes(id));
      }
    } catch (e) {
      // Ignore JSON error
    }
  }, [id]);

  const toggleWishlist = () => {
    try {
      const saved = JSON.parse(localStorage.getItem("evermore_wishlist") || "[]");
      let updated;
      if (saved.includes(id)) {
        updated = saved.filter((item) => item !== id);
        setIsWishlisted(false);
      } else {
        updated = [...saved, id];
        setIsWishlisted(true);
      }
      localStorage.setItem("evermore_wishlist", JSON.stringify(updated));
    } catch (e) {
      console.error("Wishlist toggle error:", e);
    }
  };

  const fetchProduct = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProductByIdApi(id);
      setProduct(data);
      if (data.sizes && data.sizes.length > 0) {
        // Default to first size with stock if possible
        const inStockSize = data.sizes.find((s) => {
          const stk = data.stock ? (data.stock[s] ?? 10) : 10;
          return stk > 0;
        });
        setSize(inStockSize || data.sizes[0]);
      }
    } catch (err) {
      console.error("Product detail fetch error:", err);
      setError(err.message || "Failed to load product details.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // Derive available stock for currently selected size
  const stockForSelectedSize = product?.stock
    ? (product.stock[size] !== undefined ? product.stock[size] : 10)
    : 10;
  const isOutOfStock = stockForSelectedSize <= 0;

  // Keep quantity within stock bounds (E-17)
  const maxAllowedQty = Math.max(1, Math.min(stockForSelectedSize, 10));

  const handleAdd = () => {
    if (!product || isOutOfStock) return;
    addItem(product, size, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-16 sm:pb-24 animate-pulse">
        <div className="h-4 bg-card rounded w-36 mb-6" />
        <div className="grid md:grid-cols-2 gap-8 md:gap-10">
          <div className="aspect-square rounded-3xl bg-card border border-line" />
          <div className="space-y-4">
            <div className="h-4 bg-card rounded w-24" />
            <div className="h-8 bg-card rounded w-3/4" />
            <div className="h-6 bg-card rounded w-20" />
            <div className="h-20 bg-card rounded w-full" />
            <div className="h-12 bg-card rounded w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-24 text-center">
        <div className="bg-card border border-line rounded-3xl p-10 max-w-md mx-auto">
          <AlertCircle size={36} className="mx-auto mb-3 text-wine" />
          <h2 className="font-display text-2xl font-semibold mb-2">Garment Not Found</h2>
          <p className="text-sm text-muted mb-6">{error || "The garment you are looking for does not exist in our catalog."}</p>
          <button
            onClick={() => navigate("/shop")}
            className="inline-flex items-center gap-2 bg-moss text-paper px-5 py-2.5 rounded-full text-sm font-medium hover:bg-moss/90 transition-colors"
          >
            <ArrowLeft size={15} /> Back to Shop
          </button>
        </div>
      </div>
    );
  }

  const hasImages = product.images && product.images.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-16 sm:pb-24">
      <div className="flex items-center justify-between mb-6 text-sm flex-wrap gap-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-ink-soft hover:text-ink transition-colors"
        >
          <ArrowLeft size={15} /> Back to products
        </button>
        <p className="text-muted font-mono-label text-xs truncate max-w-full">
          <Link to="/" className="hover:text-ink">
            Home
          </Link>{" "}
          / {product.name}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 md:gap-10">
        <div>
          <div className="tag-notch relative aspect-square rounded-3xl bg-card border border-line flex items-center justify-center overflow-hidden">
            {product.tag && (
              <span className="absolute top-4 left-7 z-10 font-mono-label text-[9px] sm:text-[10px] uppercase bg-wine text-paper px-2 sm:px-2.5 py-1 rounded-full max-w-[calc(100%-3rem)] truncate">
                {product.tag}
              </span>
            )}
            {hasImages ? (
              <img
                src={product.images[selectedImage] || product.images[0]}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <GarmentIcon type={product.type || "jacket"} color={product.color || "#1C1B19"} className="w-2/3 h-2/3" />
            )}
          </div>

          {hasImages && product.images.length > 1 && (
            <div className="flex gap-2.5 mt-3 overflow-x-auto pb-1">
              {product.images.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 overflow-hidden shrink-0 transition-all ${
                    selectedImage === idx
                      ? "border-moss shadow-sm"
                      : "border-line hover:border-gold/50 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={url}
                    alt={`${product.name} ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="font-mono-label text-xs uppercase text-muted mb-2">
            THE EVERMORE · {product.category}
          </p>
          <div className="flex items-start justify-between mb-2 gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold">{product.name}</h1>
            <span className="flex items-center gap-1 text-sm font-mono-label bg-card border border-line rounded-full px-2.5 py-1 shrink-0">
              <Star size={12} className="fill-ink" /> {product.rating || 4.8} ({product.reviews || 0})
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-5">
            <span className="font-mono-label text-xl sm:text-2xl">${product.price}</span>
            {product.compareAt && (
              <>
                <span className="font-mono-label text-muted line-through">${product.compareAt}</span>
                <span className="text-xs font-medium text-moss bg-moss-soft px-2 py-0.5 rounded-full">
                  Save {Math.round((1 - product.price / product.compareAt) * 100)}%
                </span>
              </>
            )}
          </div>
          <p className="text-ink-soft text-sm sm:text-base mb-6">{product.description}</p>

          {product.features && product.features.length > 0 && (
            <ul className="space-y-2 mb-7">
              {product.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-moss text-paper flex items-center justify-center shrink-0">
                    <Check size={11} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          )}

          {/* Size Selection with Stock Status (E-17) */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium">Select Size</p>
                <span className="text-xs text-muted font-mono-label">
                  {isOutOfStock ? (
                    <span className="text-wine font-medium">Out of stock</span>
                  ) : (
                    <span>{stockForSelectedSize} in stock</span>
                  )}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => {
                  const sStock = product.stock ? (product.stock[s] !== undefined ? product.stock[s] : 10) : 10;
                  const isSzOut = sStock <= 0;
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        setSize(s);
                        setQty(1);
                      }}
                      className={`min-w-10 sm:min-w-11 h-10 sm:h-11 px-3 rounded-full text-xs sm:text-sm font-mono-label border transition-colors ${
                        size === s
                          ? "bg-moss text-paper border-moss"
                          : isSzOut
                          ? "border-line text-muted opacity-40 line-through"
                          : "border-line hover:border-gold/50"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock-Constrained Quantity Selector (E-17) */}
          <div className="flex items-center gap-4 mb-6">
            <p className="text-sm font-medium">Quantity</p>
            <div className="flex items-center gap-3 bg-card border border-line rounded-full px-3 py-1.5">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={qty <= 1 || isOutOfStock}
                className="p-0.5 disabled:opacity-30"
              >
                <Minus size={14} />
              </button>
              <span className="font-mono-label w-4 text-center">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(maxAllowedQty, q + 1))}
                disabled={qty >= maxAllowedQty || isOutOfStock}
                className="p-0.5 disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
            </div>
            {qty >= maxAllowedQty && !isOutOfStock && (
              <span className="text-xs text-muted">Max quantity selected</span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-7">
            <button
              onClick={handleAdd}
              disabled={isOutOfStock}
              className="flex-1 bg-moss text-paper rounded-full py-3.5 text-sm font-medium hover:bg-moss/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isOutOfStock ? "Sold Out" : added ? "Added to Cart ✓" : `Add to Cart (${qty})`}
            </button>
            {/* Functional Wishlist Button (E-16) */}
            <button
              onClick={toggleWishlist}
              className={`border rounded-full px-5 py-3.5 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                isWishlisted
                  ? "border-wine text-wine bg-wine-soft"
                  : "border-line hover:border-gold/60 text-ink"
              }`}
            >
              <Heart size={15} className={isWishlisted ? "fill-wine text-wine" : ""} />
              {isWishlisted ? "Wishlisted" : "Wishlist"}
            </button>
          </div>

          {/* Aligned trust claims (E-22) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
            <Trust icon={ShieldCheck} title="Authentic" sub="Considered Design" />
            <Trust icon={Truck} title="Fast Delivery" sub="$6 · Free over $150" />
            <Trust icon={RefreshCcw} title="Returns" sub="30-day window" />
          </div>
        </div>
      </div>

      <div className="mt-16 bg-card border border-line rounded-2xl p-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold">Customer Reviews</h3>
            <p className="text-sm text-muted">What buyers are saying</p>
          </div>
          <span className="flex items-center gap-1.5 font-mono-label text-sm bg-paper border border-line rounded-full px-3 py-1.5">
            <Star size={13} className="fill-ink" /> {product.rating || 4.8} ({product.reviews || 0} reviews)
          </span>
        </div>
      </div>
    </div>
  );
}

function Trust({ icon: Icon, title, sub }) {
  return (
    <div className="bg-card border border-line rounded-xl py-4">
      <Icon size={17} strokeWidth={1.75} className="mx-auto mb-1.5" />
      <p className="text-xs font-medium">{title}</p>
      <p className="text-[11px] text-muted">{sub}</p>
    </div>
  );
}
