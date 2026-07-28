import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

// NOTE: this is a frontend-only mock so the UI is fully wired up.
// Swap login()/register() to call POST /api/auth/login and /api/auth/register
// against the Express backend, and store the returned JWT instead of this mock user.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = (email) => {
    const isAdmin = email.startsWith("admin");
    setUser({ name: isAdmin ? "Admin" : email.split("@")[0], email, role: isAdmin ? "admin" : "customer" });
    return { role: isAdmin ? "admin" : "customer" };
  };

  const register = (name, email) => {
    setUser({ name, email, role: "customer" });
  };

  const logout = () => setUser(null);

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
