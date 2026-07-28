import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Minus, Plus, ShieldCheck, Truck, RefreshCcw, Heart, Star } from "lucide-react";
import { getProduct, products } from "../data/products";
import GarmentIcon from "../components/GarmentIcon";
import { useCart } from "../context/CartContext";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const product = getProduct(id) || products[0];
  const [size, setSize] = useState(product.sizes[1] || product.sizes[0]);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();

  const handleAdd = () => {
    addItem(product, size, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pt-8 pb-24">
      <div className="flex items-center justify-between mb-6 text-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-ink-soft hover:text-ink transition-colors"
        >
          <ArrowLeft size={15} /> Back to products
        </button>
        <p className="text-muted font-mono-label text-xs">
          <Link to="/" className="hover:text-ink">
            Home
          </Link>{" "}
          / {product.name}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        <div className="tag-notch relative aspect-square rounded-3xl bg-card border border-line flex items-center justify-center">
          {product.tag && (
            <span className="absolute top-4 left-7 font-mono-label text-[10px] uppercase bg-wine text-paper px-2.5 py-1 rounded-full">
              {product.tag}
            </span>
          )}
          <GarmentIcon type={product.type} color={product.color} className="w-2/3 h-2/3" />
        </div>

        <div>
          <p className="font-mono-label text-xs uppercase text-muted mb-2">
            EVERMORE · {product.category}
          </p>
          <div className="flex items-start justify-between mb-2">
            <h1 className="font-display text-3xl font-semibold">{product.name}</h1>
            <span className="flex items-center gap-1 text-sm font-mono-label bg-card border border-line rounded-full px-2.5 py-1">
              <Star size={12} className="fill-ink" /> {product.rating} ({product.reviews})
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-5">
            <span className="font-mono-label text-2xl">${product.price}</span>
            {product.compareAt && (
              <>
                <span className="font-mono-label text-muted line-through">${product.compareAt}</span>
                <span className="text-xs font-medium text-moss bg-moss-soft px-2 py-0.5 rounded-full">
                  Save {Math.round((1 - product.price / product.compareAt) * 100)}%
                </span>
              </>
            )}
          </div>
          <p className="text-ink-soft mb-6">{product.description}</p>

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

          <div className="mb-6">
            <p className="text-sm font-medium mb-2">Size</p>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className={`w-11 h-11 rounded-full text-sm font-mono-label border transition-colors ${
                    size === s ? "bg-moss text-paper border-moss" : "border-line hover:border-gold/50"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <p className="text-sm font-medium">Quantity</p>
            <div className="flex items-center gap-3 bg-card border border-line rounded-full px-3 py-1.5">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-0.5">
                <Minus size={14} />
              </button>
              <span className="font-mono-label w-4 text-center">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="p-0.5">
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-7">
            <button
              onClick={handleAdd}
              className="flex-1 bg-moss text-paper rounded-full py-3.5 text-sm font-medium hover:bg-moss/90 transition-colors"
            >
              {added ? "Added ✓" : `Add to cart (${qty})`}
            </button>
            <button className="border border-line rounded-full px-5 py-3.5 text-sm font-medium flex items-center gap-2 hover:border-gold/60 transition-colors">
              <Heart size={15} /> Wishlist
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <Trust icon={ShieldCheck} title="Authentic" sub="100% Verified" />
            <Trust icon={Truck} title="Free Shipping" sub="Worldwide" />
            <Trust icon={RefreshCcw} title="Easy Returns" sub="30-day window" />
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
            <Star size={13} className="fill-ink" /> {product.rating} ({product.reviews} reviews)
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
