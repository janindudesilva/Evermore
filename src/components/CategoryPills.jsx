import { Grid2x2, Shirt, Sparkles, Star, Layers } from "lucide-react";

const icons = {
  All: Grid2x2,
  "New Arrivals": Sparkles,
  Outerwear: Layers,
  Essentials: Shirt,
  Featured: Star,
};

export default function CategoryPills({ categories, active, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {categories.map((c) => {
        const Icon = icons[c] || Grid2x2;
        const isActive = active === c;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              isActive
                ? "bg-moss text-paper border-moss"
                : "bg-card text-ink-soft border-line hover:border-gold/60"
            }`}
          >
            <Icon size={14} strokeWidth={1.75} />
            {c}
          </button>
        );
      })}
    </div>
  );
}
