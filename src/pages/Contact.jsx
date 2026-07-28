import { Mail, Phone, MapPin, Clock, ChevronDown } from "lucide-react";

const cards = [
  { icon: Mail, title: "Email Us", sub: "We'll respond within 24 hours", value: "support@theevermore.com" },
  { icon: Phone, title: "Call Us", sub: "Mon – Fri, 9:00 – 18:00", value: "+94 71 234 5678" },
  { icon: MapPin, title: "Visit Us", sub: "Our flagship studio", value: "Negombo, Sri Lanka" },
  { icon: Clock, title: "Working Hours", sub: "We're available", value: "Mon – Fri, 9:00 – 18:00" },
];

const faqs = [
  "How do I track my order?",
  "What is your return policy?",
  "Do you offer size exchanges?",
  "Can I change or cancel my order?",
];

export default function Contact() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-16 sm:pb-24">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-2">Contact Us</h1>
      <p className="text-muted text-sm sm:text-base mb-8 sm:mb-10 max-w-lg">
        Question about sizing, an order, or just want to say hello? Our team is here to help.
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
          <p className="font-mono-label text-xs uppercase text-muted mb-1">Message Us</p>
          <h2 className="font-display text-xl font-semibold mb-5">Send a Message</h2>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" placeholder="Jane Doe" />
              <Field label="Email Address" placeholder="jane@example.com" />
            </div>
            <Field label="Subject" placeholder="Select a subject" />
            <label className="block">
              <span className="text-sm font-medium mb-1.5 block">Message</span>
              <textarea
                rows={4}
                placeholder="Tell us how we can help..."
                className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
              />
            </label>
            <button className="w-full bg-moss text-paper rounded-full py-3 text-sm font-medium hover:bg-moss/90 transition-colors">
              Send Message →
            </button>
          </form>
        </div>

        <div className="bg-card border border-line rounded-2xl p-5 sm:p-7">
          <p className="font-mono-label text-xs uppercase text-muted mb-1">Common Questions</p>
          <h2 className="font-display text-xl font-semibold mb-5">FAQs</h2>
          <div className="space-y-2">
            {faqs.map((f) => (
              <div
                key={f}
                className="flex items-center justify-between bg-paper border border-line rounded-xl px-4 py-3 text-sm cursor-pointer"
              >
                {f}
                <ChevronDown size={15} className="text-muted" />
              </div>
            ))}
          </div>
          <div className="mt-5 bg-paper border border-line rounded-xl p-5 text-center">
            <p className="text-sm font-medium mb-1">Still need help?</p>
            <p className="text-xs text-muted mb-3">Our team is available Mon – Fri, 9:00 – 18:00.</p>
            <span className="text-sm font-mono-label bg-card border border-line rounded-full px-3 py-1.5 inline-block">
              support@theevermore.com
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder }) {
  return (
    <label className="block">
      <span className="text-sm font-medium mb-1.5 block">{label}</span>
      <input
        placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
      />
    </label>
  );
}
