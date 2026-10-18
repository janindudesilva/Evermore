import { useState } from "react";
import { AtSign, MessageSquare, CirclePlay, CheckCircle2 } from "lucide-react";
import logo from "../assets/Evermore Logo.jpeg";
import { submitNewsletterApi, unsubscribeNewsletterApi } from "../utils/api";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState("subscribe"); // "subscribe" | "unsubscribe"
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (mode === "subscribe" && !consent) {
      setIsError(true);
      setMessage("Please confirm your consent to receive newsletters.");
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      setIsError(false);

      if (mode === "subscribe") {
        const res = await submitNewsletterApi(email, consent);
        setMessage(res.message || "Thank you for subscribing to THE EVERMORE.");
        setEmail("");
        setConsent(false);
      } else {
        const res = await unsubscribeNewsletterApi(email);
        setMessage(res.message || "You have been unsubscribed from the newsletter.");
        setEmail("");
      }
    } catch (err) {
      setIsError(true);
      setMessage(err.message || "Operation failed. Please check your email address.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer className="mt-16 sm:mt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
        <div className="bg-card border border-line rounded-3xl px-5 sm:px-8 py-8 sm:py-12 text-center mb-10 sm:mb-14">
          <p className="font-mono-label text-xs text-muted uppercase mb-3">Stay Stitched In</p>
          <h3 className="font-display text-2xl sm:text-3xl font-semibold mb-3">
            {mode === "subscribe" ? "Join the mailing list" : "Unsubscribe from mailing list"}
          </h3>
          <p className="text-ink-soft text-sm sm:text-base mb-7 max-w-md mx-auto">
            {mode === "subscribe"
              ? "New drops, restocks, and seasonal previews — delivered thoughtfully."
              : "Enter your email address to remove yourself from our newsletter list."}
          </p>

          {message && (
            <div
              className={`mb-4 max-w-sm mx-auto p-3 rounded-xl text-xs flex items-center justify-center gap-2 ${
                isError ? "bg-wine-soft text-wine border border-wine/20" : "bg-moss-soft text-moss border border-moss/20"
              }`}
            >
              {!isError && <CheckCircle2 size={14} />}
              <span>{message}</span>
            </div>
          )}

          <form className="max-w-sm mx-auto space-y-3" onSubmit={handleSubmit}>
            <div className="flex flex-col sm:flex-row items-center gap-2.5">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full sm:flex-1 rounded-full border border-line bg-paper px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto rounded-full bg-moss text-paper px-5 py-2.5 text-sm font-medium whitespace-nowrap hover:bg-moss/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Processing..." : mode === "subscribe" ? "Subscribe" : "Unsubscribe"}
              </button>
            </div>

            {mode === "subscribe" && (
              <label className="flex items-center justify-center gap-2 text-xs text-muted cursor-pointer text-left px-2">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  required
                  className="rounded border-line text-moss focus:ring-gold/35 shrink-0"
                />
                <span>I agree to receive THE EVERMORE journal and agree to the privacy policy.</span>
              </label>
            )}

            <div className="pt-1">
              {mode === "subscribe" ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode("unsubscribe");
                    setMessage(null);
                    setIsError(false);
                  }}
                  className="text-xs text-muted hover:text-ink underline transition-colors"
                >
                  Need to unsubscribe?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode("subscribe");
                    setMessage(null);
                    setIsError(false);
                  }}
                  className="text-xs text-muted hover:text-ink underline transition-colors"
                >
                  ← Back to newsletter subscription
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-line">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 font-display font-semibold mb-2">
              <img src={logo} alt="The Evermore Logo" className="w-6 h-6 rounded-full object-cover" />
              THE EVERMORE
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
          © 2026 THE EVERMORE. All rights reserved.
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
