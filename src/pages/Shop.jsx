import { useState, useEffect } from "react";
import { Search, AlertCircle, Package } from "lucide-react";
import ProductCard from "../components/ProductCard";
import CategoryPills from "../components/CategoryPills";

const categories = ["All", "New Arrivals", "Outerwear", "Essentials", "Featured"];

export default function Shop() {
  const [active, setActive] = useState("All");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProducts = async (cat = active, query = search) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (cat !== "All") params.append("category", cat);
      if (query.trim()) params.append("q", query.trim());

      const url = `/api/products${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();

      if (res.ok && data.success) {
        setProducts(data.data);
      } else {
        throw new Error(data.message || "Failed to fetch products");
      }
    } catch (err) {
      console.error("Shop fetch error:", err);
      setError(err.message || "Unable to connect to product service");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(active, search);
  }, [active, search]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 sm:pb-24">
      <div className="mb-8">
        <p className="font-mono-label text-xs uppercase text-muted mb-2">Full Catalog</p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold heading-rule">Shop All</h1>
          <div className="relative max-w-xs w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search garments..."
              className="w-full rounded-full border border-line bg-card pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
            />
          </div>
        </div>
        <CategoryPills categories={categories} active={active} onChange={setActive} />
      </div>

      {!loading && !error && (
        <p className="text-sm text-muted mb-5">
          Showing {products.length} {products.length === 1 ? "item" : "items"}
        </p>
      )}

      {error ? (
        <div className="bg-wine-soft text-wine border border-wine/20 rounded-2xl p-6 text-center my-6">
          <AlertCircle size={24} className="mx-auto mb-2" />
          <p className="font-medium text-sm mb-3">{error}</p>
          <button
            onClick={() => fetchProducts(active, search)}
            className="px-4 py-1.5 bg-paper text-ink border border-line rounded-full text-xs font-medium hover:border-gold"
          >
            Retry
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
        <div className="bg-card border border-line rounded-2xl p-12 text-center my-6">
          <Package size={36} className="mx-auto mb-3 text-muted" />
          <h3 className="font-display text-lg font-medium mb-1">No products found</h3>
          <p className="text-sm text-muted max-w-sm mx-auto">
            We couldn't find any products matching your selected category or search term.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
          {products.map((p) => (
            <ProductCard key={p._id || p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
