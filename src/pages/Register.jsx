import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await register(name, email, password);
      navigate("/account");
    } catch (err) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-16 sm:pb-24">
      <Link to="/" className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-6">
        <ArrowLeft size={15} /> Back to home
      </Link>
      <div className="bg-card border border-line rounded-3xl p-6 sm:p-10">
        <p className="font-mono-label text-xs uppercase text-muted mb-2">Join THE EVERMORE</p>
        <h1 className="font-display text-3xl font-semibold mb-2">Create Account</h1>
        <p className="text-sm text-muted mb-6">
          Already have one?{" "}
          <Link to="/sign-in" className="text-ink underline underline-offset-2">
            Sign in
          </Link>
        </p>

        {error && (
          <div className="mb-5 p-3.5 bg-wine-soft text-wine border border-wine/20 rounded-xl text-sm flex items-center gap-2.5">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium mb-1.5 block">Full Name</span>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                required
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
                required
                className="w-full rounded-xl border border-line bg-paper pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-sm font-medium mb-1.5 block">Password</span>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full rounded-xl border border-line bg-paper pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/35"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-moss text-paper rounded-full py-3 text-sm font-medium hover:bg-moss/90 transition-colors disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
