import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, RefreshCcw, Truck } from "lucide-react";
import { products, categories } from "../data/products";
import ProductCard from "../components/ProductCard";
import CategoryPills from "../components/CategoryPills";
import GarmentIcon from "../components/GarmentIcon";

export default function Home() {
  const [active, setActive] = useState("All");
  const featuredProduct = products[0];
  const visible = active === "All" ? products : products.filter((p) => p.category === active);

  return (
    <div className="max-w-6xl mx-auto px-6">
      <section className="grid md:grid-cols-2 gap-10 items-center pt-14 pb-16">
        <div>
          <span className="inline-flex items-center gap-2 font-mono-label text-xs uppercase bg-card border border-line rounded-full px-3 py-1.5 mb-6 text-ink-soft">
            ✦ New season · Limited runs
          </span>
          <h1 className="font-display text-5xl md:text-6xl font-semibold leading-[1.05] tracking-tight mb-5">
            Clothing built to be worn, not just owned.
          </h1>
          <p className="text-ink-soft text-lg max-w-md mb-8">
            Small-batch essentials and outerwear, cut from natural fibers and made to hold up to
            everyday wear.
          </p>
          <div className="flex items-center gap-3 mb-10">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 bg-moss text-paper px-5 py-3 rounded-full text-sm font-medium hover:bg-moss/90 transition-colors"
            >
              Shop the Collection <ArrowRight size={15} />
            </Link>
            <Link
              to="/shop"
              className="bg-card border border-line px-5 py-3 rounded-full text-sm font-medium hover:border-gold/60 transition-colors"
            >
              View Best Sellers
            </Link>
          </div>
          <div className="flex flex-wrap gap-6">
            <Feature icon={ShieldCheck} title="Natural Fibers" sub="Cotton, linen, wool" />
            <Feature icon={RefreshCcw} title="Easy Returns" sub="30-day window" />
            <Feature icon={Truck} title="Fast Shipping" sub="Tracked, worldwide" />
          </div>
        </div>

        <div className="relative">
          <div className="aspect-square rounded-3xl bg-card border border-line flex items-center justify-center overflow-hidden">
            <GarmentIcon type={featuredProduct.type} color={featuredProduct.color} className="w-2/3 h-2/3" />
          </div>
          <Link
            to={`/product/${featuredProduct.id}`}
            className="absolute bottom-5 left-5 bg-card border border-line rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm hover:-translate-y-0.5 transition-transform"
          >
            <div>
              <p className="text-sm font-medium">{featuredProduct.name}</p>
              <p className="font-mono-label text-xs text-muted">${featuredProduct.price}</p>
            </div>
          </Link>
        </div>
      </section>

      <section className="pb-24">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h2 className="font-display text-2xl font-semibold heading-rule">The Collection</h2>
          <CategoryPills categories={categories} active={active} onChange={setActive} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
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
