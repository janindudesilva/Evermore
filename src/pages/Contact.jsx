import { useState } from "react";
import { Mail, Phone, MapPin, Clock, ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";
import { submitContactApi } from "../utils/api";

const cards = [
  { icon: Mail, title: "Email Us", sub: "We'll respond within 24 hours", value: "support@theevermore.com" },
  { icon: Phone, title: "Call Us", sub: "Mon – Fri, 9:00 – 18:00", value: "+94 71 234 5678" },
  { icon: MapPin, title: "Visit Us", sub: "Flagship studio", value: "Negombo, Sri Lanka" },
  { icon: Clock, title: "Working Hours", sub: "Available", value: "Mon – Fri, 9:00 – 18:00" },
];

const faqs = [
  { q: "How do I track my order?", a: "Once your order is placed, you can monitor its progress in real-time under My Account -> Order History or using your order reference." },
  { q: "What is your return policy?", a: "We offer a 30-day window for returns of unworn garments in their original condition and packaging." },
  { q: "Do you offer size exchanges?", a: "Yes, contact our studio team with your order reference and desired size to arrange a complimentary size exchange." },
  { q: "Can I cancel my order?", a: "Orders in 'Pending' status can be cancelled directly through your Account dashboard, immediately releasing reserved stock." },
];

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "Sizing & Fit",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setError("Please complete all required fields.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await submitContactApi(formData);
      setSuccess(res.message || "Thank you. Your message has been received.");
      setFormData({ name: "", email: "", subject: "Sizing & Fit", message: "" });
    } catch (err) {
      setError(err.message || "Could not deliver message. Please try again or email us directly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 sm:pb-24">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-2">Contact Us</h1>
      <p className="text-muted text-sm sm:text-base mb-8 sm:mb-10 max-w-lg">
        Questions about sizing, an order, or atelier craftsmanship? Our studio team is here to assist.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
        {cards.map((c) => (
          <div key={c.title} className="bg-card border border-line rounded-2xl p-4 sm:p-5">
            <span className="w-9 h-9 rounded-full bg-paper border border-line flex items-center justify-center mb-3">
              <c.icon size={16} strokeWidth={1.75} />
            </span>
            <p className="font-medium text-sm">{c.title}</p>
            <p className="text-xs text-muted mb-2">{c.sub}</p>
            <p className="text-sm font-mono-label">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card border border-line rounded-2xl p-5 sm:p-7">
          <p className="font-mono-label text-xs uppercase text-muted mb-1">Message Atelier</p>
          <h2 className="font-display text-xl font-semibold mb-5">Send an Inquiry</h2>

          {success && (
            <div className="mb-4 p-4 bg-moss-soft text-moss border border-moss/20 rounded-xl text-sm flex items-center gap-2.5">
              <CheckCircle2 size={18} className="shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-wine-soft text-wine border border-wine/20 rounded-xl text-sm flex items-center gap-2.5">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium mb-1.5 block">Full Name</span>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Jane Doe"
                  className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium mb-1.5 block">Email Address</span>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="jane@example.com"
                  className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Subject</span>
              <select
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
              >
                <option>Sizing & Fit</option>
                <option>Order Status</option>
                <option>Returns & Exchanges</option>
                <option>Wholesale & Press</option>
                <option>General Inquiry</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Message</span>
              <textarea
                rows={4}
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Tell us how we can help..."
                className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-moss text-paper rounded-full py-3 text-sm font-medium hover:bg-moss/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Sending Message..." : "Send Message →"}
            </button>
          </form>
        </div>

        <div className="bg-card border border-line rounded-2xl p-5 sm:p-7">
          <p className="font-mono-label text-xs uppercase text-muted mb-1">Common Questions</p>
          <h2 className="font-display text-xl font-semibold mb-5">FAQs</h2>
          <div className="space-y-2.5">
            {faqs.map((f, idx) => {
              const isExpanded = expandedFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-paper border border-line rounded-xl overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left"
                  >
                    <span>{f.q}</span>
                    <ChevronDown
                      size={15}
                      className={`text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3.5 pt-1 text-xs text-muted border-t border-line/60">
                      {f.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 bg-paper border border-line rounded-xl p-5 text-center">
            <p className="text-sm font-medium mb-1">Direct Support</p>
            <p className="text-xs text-muted mb-3">Our team is available Mon – Fri, 9:00 – 18:00 (GMT+5:30).</p>
            <span className="text-sm font-mono-label bg-card border border-line rounded-full px-3.5 py-1.5 inline-block text-ink">
              support@theevermore.com
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
