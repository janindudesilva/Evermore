import { Link, NavLink } from "react-router-dom";
import { Search, Heart, ShoppingBag, User } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/Evermore Logo.jpeg";

const links = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/contact", label: "Contact" },
  { to: "/about", label: "About" },
];

export default function Navbar() {
  const { count } = useCart();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-display font-semibold text-lg tracking-tight">
          <img src={logo} alt="Evermore Logo" className="w-7 h-7 rounded-full object-cover" />
          EVERMORE
        </Link>

        <nav className="hidden md:flex items-center gap-1 bg-card border border-line rounded-full px-1.5 py-1.5">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive ? "bg-moss text-paper" : "text-ink-soft hover:text-moss"
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-card border border-transparent hover:border-line transition-colors">
            <Search size={17} strokeWidth={1.75} />
          </button>
          <Link
            to={user ? (user.role === "admin" ? "/admin" : "/account") : "/sign-in"}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-card border border-transparent hover:border-line transition-colors"
            title={user ? user.name : "Sign in"}
          >
            <User size={17} strokeWidth={1.75} />
          </Link>
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-card border border-transparent hover:border-line transition-colors">
            <Heart size={17} strokeWidth={1.75} />
          </button>
          <Link
            to="/cart"
            className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-card border border-transparent hover:border-line transition-colors"
          >
            <ShoppingBag size={17} strokeWidth={1.75} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-wine text-paper text-[10px] font-mono-label flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
