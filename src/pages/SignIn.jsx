import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import GarmentIcon from "../components/GarmentIcon";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const loggedUser = await login(email, password);
      navigate(loggedUser?.role === "admin" ? "/admin" : "/account");
    } catch (err) {
      setError(err.message || "Failed to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-16 sm:pb-24">
      <Link to="/" className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-6">
        <ArrowLeft size={15} /> Back to home
      </Link>

      <div className="grid md:grid-cols-2 gap-0 bg-card border border-line rounded-3xl overflow-hidden">
        <div className="hidden md:flex flex-col justify-between bg-moss text-paper p-10 relative">
          <span className="font-mono-label text-xs uppercase bg-paper/15 w-fit px-2.5 py-1 rounded-full">
            THE EVERMORE
          </span>
          <div className="flex items-center justify-center py-16">
            <GarmentIcon type="jacket" color="#FFFEFA" className="w-2/3 h-2/3 opacity-90" />
          </div>
          <div>
            <p className="italic text-lg mb-4">"Buy less. Choose well. Make it last."</p>
            <ul className="space-y-1.5 text-sm text-paper/80">
              <li>✓ Small-batch production</li>
              <li>✓ Secure checkout</li>
              <li>✓ Free returns</li>
            </ul>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <p className="font-mono-label text-xs uppercase text-muted mb-2">Welcome Back</p>
          <h1 className="font-display text-3xl font-semibold mb-2">Sign In</h1>
          <p className="text-sm text-muted mb-6">
            Don't have an account?{" "}
            <Link to="/register" className="text-ink underline underline-offset-2">
              Create one free
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
              <span className="text-sm font-medium mb-1.5 block">Email Address</span>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@loom.com"
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
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <p className="text-xs text-muted text-center pt-1">
              Admin login: <code className="font-mono bg-paper px-1.5 py-0.5 rounded border border-line">admin@loom.com</code> / <code className="font-mono bg-paper px-1.5 py-0.5 rounded border border-line">admin123</code>
            </p>
          </form>

          <div className="mt-6 pt-6 border-t border-line">
            <Link
              to="/checkout"
              className="block text-center text-sm text-ink-soft hover:text-ink transition-colors"
            >
              Or continue as guest →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
