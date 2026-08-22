import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, RefreshCcw, Truck, AlertCircle, Package } from "lucide-react";
import ProductCard from "../components/ProductCard";
import CategoryPills from "../components/CategoryPills";
import GarmentIcon from "../components/GarmentIcon";
import JacketVideoScrubber from "../components/JacketVideoScrubber";
import { getProductsApi } from "../utils/api";

const categories = ["All", "New Arrivals", "Outerwear", "Essentials", "Featured"];

export default function Home() {
  const [active, setActive] = useState("All");
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = async (cat = "All") => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProductsApi(cat);
      setProducts(data);
      if (cat === "All") {
        setAllProducts(data);
      }
    } catch (err) {
      console.error("Home fetch error:", err);
      setError(err.message || "Could not load products.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(active);
  }, [active]);

  const featuredProduct = allProducts[0] || products[0] || {
    _id: "evermore-field-jacket",
    name: "Field Jacket",
    price: 128,
    type: "jacket",
    color: "#2C3B2D",
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      {/* Normal Hero Section Layout */}
      <section className="grid md:grid-cols-2 gap-8 md:gap-10 items-center pt-8 sm:pt-14 pb-12 sm:pb-16">
        <div>
          <span className="inline-flex items-center gap-2 font-mono-label text-xs uppercase bg-card border border-line rounded-full px-3 py-1.5 mb-4 sm:mb-6 text-ink-soft">
            ✦ New season · Limited runs
          </span>
          <h1 className="font-display text-3xl sm:text-5xl md:text-6xl font-semibold leading-[1.1] sm:leading-[1.05] tracking-tight mb-4 sm:mb-5">
            Clothing built to be worn, not just owned.
          </h1>
          <p className="text-ink-soft text-base sm:text-lg max-w-md mb-6 sm:mb-8">
            Small-batch essentials and outerwear, cut from natural fibers and made to hold up to
            everyday wear.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8 sm:mb-10">
            <Link
              to="/shop"
              className="inline-flex items-center justify-center gap-2 bg-moss text-paper px-5 py-3 rounded-full text-sm font-medium hover:bg-moss/90 transition-colors"
            >
              Shop the Collection <ArrowRight size={15} />
            </Link>
            <Link
              to="/shop"
              className="inline-flex items-center justify-center bg-card border border-line px-5 py-3 rounded-full text-sm font-medium hover:border-gold/60 transition-colors"
            >
              View Best Sellers
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <Feature icon={ShieldCheck} title="Natural Fibers" sub="Cotton, linen, wool" />
            <Feature icon={RefreshCcw} title="Easy Returns" sub="30-day window" />
            <Feature icon={Truck} title="Fast Shipping" sub="Tracked, worldwide" />
          </div>
        </div>

        {/* Step 1: JacketVideoScrubber rendered in normal layout spot */}
        <div className="relative mt-4 md:mt-0 max-w-lg mx-auto w-full">
          <JacketVideoScrubber product={featuredProduct} />
        </div>
      </section>

      <section className="pb-16 sm:pb-24">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h2 className="font-display text-xl sm:text-2xl font-semibold heading-rule">The Collection</h2>
          <CategoryPills categories={categories} active={active} onChange={setActive} />
        </div>

        {error ? (
          <div className="bg-wine-soft text-wine border border-wine/20 rounded-2xl p-6 text-center my-6">
            <AlertCircle size={24} className="mx-auto mb-2" />
            <p className="font-medium text-sm mb-3">{error}</p>
            <button
              onClick={() => fetchProducts(active)}
              className="px-4 py-1.5 bg-paper text-ink border border-line rounded-full text-xs font-medium hover:border-gold"
            >
              Try Again
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="bg-card border border-line rounded-2xl p-4 animate-pulse">
                <div className="aspect-[4/5] bg-paper/60 rounded-xl mb-3" />
                <div className="h-3 bg-paper/60 rounded w-2/3 mb-2" />
                <div className="h-4 bg-paper/60 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="bg-card border border-line rounded-2xl p-10 text-center my-6">
            <Package size={32} className="mx-auto mb-3 text-muted" />
            <p className="font-medium mb-1">No products found</p>
            <p className="text-sm text-muted">Try selecting a different category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
            {products.map((p) => (
              <ProductCard key={p._id || p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Feature({ icon: Icon, title, sub }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-full bg-card border border-line flex items-center justify-center shrink-0">
        <Icon size={16} strokeWidth={1.75} className="text-gold" />
      </span>
      <div>
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="text-xs text-muted leading-tight">{sub}</p>
      </div>
    </div>
  );
}
