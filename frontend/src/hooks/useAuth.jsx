import { createContext, useContext, useMemo, useState } from "react";
import api, { clearTokens, getAccessToken, getRefreshToken, setTokens } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inited, setInited] = useState(false);

  const refreshUser = async () => {
    try {
      const response = await api.get("/auth/me");
      setUser(response.data);
      return response.data;
    } catch (error) {
      setUser(null);
      throw error;
    }
  };

  const init = async () => {
    const accessToken = getAccessToken();
    const refreshToken = getRefreshToken();
    if (!accessToken || !refreshToken) {
      setLoading(false);
      setUser(null);
      return;
    }
    try {
      await refreshUser();
    } catch (error) {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await api.post("/auth/login", { email, password });
    setTokens(response.data.access_token, response.data.refresh_token);
    setLoading(true);
    try { return await refreshUser(); }
    finally { setLoading(false); }
  };

  const register = async (email, password, name) => {
    const response = await api.post("/auth/register", {
      email, password, full_name: name || null,
    });
    setTokens(response.data.access_token, response.data.refresh_token);
    setLoading(true);
    try { return await refreshUser(); }
    finally { setLoading(false); }
  };

  const logout = () => {
    clearTokens();
    setUser(null);
    if (typeof window !== "undefined") { window.location.replace("/login"); }
  };

  if (!inited) { setInited(true); init(); }

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) { throw new Error("useAuth must be used within AuthProvider"); }
  return context;
}
