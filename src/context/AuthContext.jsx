import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchJson, apiFetch } from "../utils/api";

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
        const data = await fetchJson("/api/auth/me");
        if (data && data.success && data.data) {
          setUser(data.data);
          setToken(storedToken);
        } else {
          localStorage.removeItem("token");
          setUser(null);
          setToken(null);
        }
      } catch (err) {
        console.warn("Auth session validation failed:", err.message);
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
    const data = await fetchJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const { user: userData, token: jwtToken } = data.data;
    localStorage.setItem("token", jwtToken);
    setToken(jwtToken);
    setUser(userData);
    return userData;
  };

  const register = async (name, email, password) => {
    const data = await fetchJson("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    const { user: userData, token: jwtToken } = data.data;
    localStorage.setItem("token", jwtToken);
    setToken(jwtToken);
    setUser(userData);
    return userData;
  };

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  // Centralized authFetch respecting VITE_API_URL
  const authFetch = useCallback((url, options = {}) => {
    return apiFetch(url, options);
  }, []);

  const updateProfile = async (profileData) => {
    const res = await fetchJson("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(profileData),
    });
    if (res.success && res.data) {
      setUser(res.data);
    }
    return res.data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        authFetch,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
