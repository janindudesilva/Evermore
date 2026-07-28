import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Lock } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    register(name || "New Customer", email || "you@example.com");
    navigate("/account");
  };

  return (
    <div className="max-w-md mx-auto px-6 pt-8 pb-24">
      <Link to="/" className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-6">
        <ArrowLeft size={15} /> Back to home
      </Link>
      <div className="bg-card border border-line rounded-3xl p-10">
        <p className="font-mono-label text-xs uppercase text-muted mb-2">Join EVERMORE</p>
        <h1 className="font-display text-3xl font-semibold mb-2">Create Account</h1>
        <p className="text-sm text-muted mb-6">
          Already have one?{" "}
          <Link to="/sign-in" className="text-ink underline underline-offset-2">
            Sign in
          </Link>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium mb-1.5 block">Full Name</span>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-xl border border-line bg-paper pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium mb-1.5 block">Email Address</span>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full rounded-xl border border-line bg-paper pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium mb-1.5 block">Password</span>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="password"
                placeholder="••••••••"
                className="w-full rounded-xl border border-line bg-paper pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
              />
            </div>
          </label>
          <button
            type="submit"
            className="w-full bg-moss text-paper rounded-full py-3 text-sm font-medium hover:bg-moss/90 transition-colors"
          >
            Create Account
          </button>
        </form>
      </div>
    </div>
  );
}
