const paths = {
  tee: "M70 40 L98 28 L130 50 L118 76 L100 66 L100 190 L60 190 L60 66 L42 76 L30 50 Z",
  jacket:
    "M62 36 L98 22 L134 36 L150 58 L134 72 L128 64 L128 190 L70 190 L70 64 L64 72 L48 58 Z M98 22 L98 60",
  trousers: "M58 30 H140 L146 190 H112 L99 100 L86 190 H52 Z",
  dress: "M78 34 L120 34 L128 60 L112 70 L112 90 L136 190 H62 L86 90 L86 70 L70 60 Z",
  shirt:
    "M64 38 L98 24 L132 38 L150 60 L132 74 L126 66 L126 188 L70 188 L70 66 L64 74 L46 60 Z M98 24 V50",
  skirt: "M64 40 H132 L150 190 H46 Z",
};

const viewBoxes = {
  tee: "0 0 160 210",
  jacket: "0 0 200 210",
  trousers: "0 0 200 210",
  dress: "0 0 200 210",
  shirt: "0 0 200 210",
  skirt: "0 0 200 210",
};

export default function GarmentIcon({ type, color = "#1C1B19", className = "" }) {
  const d = paths[type] || paths.tee;
  const viewBox = viewBoxes[type] || "0 0 160 210";
  return (
    <svg viewBox={viewBox} className={className} aria-hidden="true">
      <path
        d={d}
        fill={color}
        fillOpacity="0.14"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
