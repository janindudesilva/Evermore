import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import GarmentIcon from "./GarmentIcon";

export default function ProductCard({ product }) {
  const prodId = product._id || product.id;
  const hasImage = product.images && product.images.length > 0;
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("evermore_wishlist") || "[]");
      if (Array.isArray(saved) && prodId) {
        setIsWishlisted(saved.includes(prodId));
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }, [prodId]);

  const handleToggleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const saved = JSON.parse(localStorage.getItem("evermore_wishlist") || "[]");
      let updated;
      if (saved.includes(prodId)) {
        updated = saved.filter((id) => id !== prodId);
        setIsWishlisted(false);
      } else {
        updated = [...saved, prodId];
        setIsWishlisted(true);
      }
      localStorage.setItem("evermore_wishlist", JSON.stringify(updated));
    } catch (err) {
      console.error("Card wishlist error:", err);
    }
  };

  return (
    <Link
      to={`/product/${prodId}`}
      className="tag-notch group block bg-card border border-line rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_-12px_rgba(28,27,25,0.16)] hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative aspect-[4/5] bg-paper flex items-center justify-center overflow-hidden">
        <button
          onClick={handleToggleWishlist}
          className={`absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
            isWishlisted
              ? "bg-wine-soft border-wine/40 text-wine"
              : "bg-card border-line text-ink-soft hover:text-wine"
          }`}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={14} strokeWidth={1.75} className={isWishlisted ? "fill-wine text-wine" : ""} />
        </button>
        {product.tag && (
          <span className="absolute top-2.5 sm:top-3 left-6 z-10 font-mono-label text-[9px] sm:text-[10px] uppercase bg-wine text-paper px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full max-w-[calc(100%-4.2rem)] truncate">
            {product.tag}
          </span>
        )}
        {hasImage ? (
          <img
            src={product.images[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <GarmentIcon
            type={product.type}
            color={product.color}
            className="w-2/3 h-2/3 group-hover:scale-105 transition-transform duration-300"
          />
        )}
      </div>
      <div className="p-3 sm:p-4">
        <p className="font-mono-label text-[10px] sm:text-[11px] uppercase text-muted mb-1 truncate">
          THE EVERMORE · {product.line || product.category}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
          <p className="font-medium text-xs sm:text-sm leading-tight text-ink">{product.name}</p>
          <div className="text-left sm:text-right shrink-0">
            {product.compareAt && (
              <span className="text-xs text-muted line-through mr-1 font-mono-label">
                ${product.compareAt}
              </span>
            )}
            <span className="font-mono-label text-xs sm:text-sm font-medium">${product.price}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
