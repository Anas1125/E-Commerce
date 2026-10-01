import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import AuthContext from "./auth-context";

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem("access_token")));

  useEffect(() => {
    if (!localStorage.getItem("access_token")) return;
    api.get("/auth/me")
      .then(({ data }) => setUser(data))
      .catch((error) => {
        if (error.response?.status === 401) localStorage.removeItem("access_token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback((token, userData) => {
    localStorage.setItem("access_token", token);
    setUser(userData);
  }, []);
  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setUser(null);
  }, []);
  const value = { user, loading, login, logout, isAuthenticated: Boolean(user) };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
