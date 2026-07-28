import { useState } from "react";
import { products, categories } from "../data/products";
import ProductCard from "../components/ProductCard";
import CategoryPills from "../components/CategoryPills";

export default function Shop() {
  const [active, setActive] = useState("All");
  const visible = active === "All" ? products : products.filter((p) => p.category === active);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 sm:pb-24">
      <div className="mb-8">
        <p className="font-mono-label text-xs uppercase text-muted mb-2">Full Catalog</p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-6 heading-rule">Shop All</h1>
        <CategoryPills categories={categories} active={active} onChange={setActive} />
      </div>
      <p className="text-sm text-muted mb-5">{visible.length} items</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
        {visible.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
