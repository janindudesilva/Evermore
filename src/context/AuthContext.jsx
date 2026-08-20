import { createContext, useContext, useState, useEffect } from "react";
import { fetchJson } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  // Validate stored token on mount
  useEffect(() => {
    async function checkAuth() {
      const storedToken = localStorage.getItem("token");
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const data = await fetchJson("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });
        if (data.success) {
          setUser(data.data);
          setToken(storedToken);
        } else {
          localStorage.removeItem("token");
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.warn("Auth check failed:", err.message);
        localStorage.removeItem("token");
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const data = await fetchJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const { user: userData, token: jwtToken } = data.data;
      localStorage.setItem("token", jwtToken);
      setToken(jwtToken);
      setUser(userData);
      return userData;
    } catch (err) {
      if (err.message.includes("HTML")) {
        // Fallback for previewing UI without backend
        const isAdmin = email.startsWith("admin");
        const mockUser = {
          _id: "mock-user-1",
          name: isAdmin ? "Admin" : email.split("@")[0],
          email,
          role: isAdmin ? "admin" : "customer",
        };
        setUser(mockUser);
        return mockUser;
      }
      throw err;
    }
  };

  const register = async (name, email, password) => {
    try {
      const data = await fetchJson("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const { user: userData, token: jwtToken } = data.data;
      localStorage.setItem("token", jwtToken);
      setToken(jwtToken);
      setUser(userData);
      return userData;
    } catch (err) {
      if (err.message.includes("HTML")) {
        const mockUser = { _id: `user-${Date.now()}`, name, email, role: "customer" };
        setUser(mockUser);
        return mockUser;
      }
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const authFetch = (url, options = {}) => {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
