import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import GarmentIcon from "./GarmentIcon";

export default function ProductCard({ product }) {
  return (
    <Link
      to={`/product/${product.id}`}
      className="tag-notch group block bg-card border border-line rounded-2xl overflow-hidden hover:shadow-[0_8px_30px_-12px_rgba(28,27,25,0.16)] hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative aspect-[4/5] bg-paper flex items-center justify-center">
        <button
          onClick={(e) => e.preventDefault()}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-card border border-line flex items-center justify-center hover:text-wine transition-colors"
        >
          <Heart size={14} strokeWidth={1.75} />
        </button>
        {product.tag && (
          <span className="absolute top-3 left-6 z-10 font-mono-label text-[10px] uppercase bg-wine text-paper px-2 py-1 rounded-full">
            {product.tag}
          </span>
        )}
        <GarmentIcon
          type={product.type}
          color={product.color}
          className="w-2/3 h-2/3 group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-4">
        <p className="font-mono-label text-[11px] uppercase text-muted mb-1">
          EVERMORE · {product.line}
        </p>
        <div className="flex items-center justify-between">
          <p className="font-medium">{product.name}</p>
          <div className="text-right">
            {product.compareAt && (
              <span className="text-xs text-muted line-through mr-1 font-mono-label">
                ${product.compareAt}
              </span>
            )}
            <span className="font-mono-label text-sm">${product.price}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
