import { AtSign, MessageSquare, CirclePlay } from "lucide-react";
import logo from "../assets/Evermore Logo.jpeg";

export default function Footer() {
  return (
    <footer className="mt-24">
      <div className="max-w-6xl mx-auto px-6 pb-10">
        <div className="bg-card border border-line rounded-3xl px-8 py-12 text-center mb-14">
          <p className="font-mono-label text-xs text-muted uppercase mb-3">Stay Stitched In</p>
          <h3 className="font-display text-3xl font-semibold mb-3">Join the mailing list</h3>
          <p className="text-ink-soft mb-7 max-w-md mx-auto">
            New drops, restocks, and the occasional discount — no more than twice a month.
          </p>
          <form className="flex items-center gap-2 max-w-sm mx-auto" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
            />
            <button className="rounded-full bg-moss text-paper px-5 py-2.5 text-sm font-medium whitespace-nowrap hover:bg-moss/90 transition-colors">
              Subscribe
            </button>
          </form>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-line">
          <div>
            <div className="flex items-center gap-2 font-display font-semibold mb-2">
              <img src={logo} alt="Evermore Logo" className="w-6 h-6 rounded-full object-cover" />
              EVERMORE
            </div>
            <p className="text-sm text-muted mb-4">Considered clothing, made to last.</p>
            <div className="flex gap-2">
              {[AtSign, MessageSquare, CirclePlay].map((Icon, i) => (
                <span
                  key={i}
                  className="w-8 h-8 rounded-full bg-paper border border-line flex items-center justify-center"
                >
                  <Icon size={14} strokeWidth={1.75} />
                </span>
              ))}
            </div>
          </div>
          <FooterCol title="Shop" items={["New Arrivals", "Essentials", "Outerwear", "Featured"]} />
          <FooterCol title="Support" items={["Contact Us", "Sizing Guide", "Shipping", "Returns"]} />
          <FooterCol title="Company" items={["About", "Careers", "Journal"]} />
        </div>
        <p className="text-xs text-muted text-center pt-6 font-mono-label">
          © 2026 EVERMORE. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }) {
  return (
    <div>
      <p className="font-mono-label text-xs uppercase text-muted mb-3">{title}</p>
      <ul className="space-y-2 text-sm text-ink-soft">
        {items.map((i) => (
          <li key={i} className="hover:text-ink cursor-pointer transition-colors">
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
