import GarmentIcon from "../components/GarmentIcon";

export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-6 pt-10 pb-24">
      <p className="font-mono-label text-xs uppercase text-muted mb-2">Our Story</p>
      <h1 className="font-display text-4xl font-semibold mb-6">Made to be worn, not archived.</h1>
      <p className="text-ink-soft text-lg mb-10 max-w-2xl">
        EVERMORE started as a small run of ten jackets sewn in a single workshop. We still work with the
        same principle: fewer pieces, better fabric, made to outlast a season.
      </p>
      <div className="grid grid-cols-3 gap-4 mb-14">
        {["jacket", "tee", "trousers"].map((t) => (
          <div key={t} className="aspect-square bg-card border border-line rounded-2xl flex items-center justify-center">
            <GarmentIcon type={t} color="#1C1B19" className="w-1/2 h-1/2" />
          </div>
        ))}
      </div>
      <div className="grid md:grid-cols-3 gap-8">
        <Value title="Natural Fibers" text="Cotton, linen, and wool sourced from long-standing mills." />
        <Value title="Small Batches" text="We produce in limited runs instead of chasing constant restocks." />
        <Value title="Built to Last" text="Reinforced seams and finishes meant for years, not one season." />
      </div>
    </div>
  );
}

function Value({ title, text }) {
  return (
    <div>
      <h3 className="font-medium mb-2">{title}</h3>
      <p className="text-sm text-ink-soft">{text}</p>
    </div>
  );
}
