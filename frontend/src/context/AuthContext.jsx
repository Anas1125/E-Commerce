import { useCallback, useEffect, useState } from "react";
import api from "../services/api";
import AuthContext from "./auth-context";

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [loading, setLoading] = useState(() =>
    Boolean(localStorage.getItem("access_token")),
  );

  const refreshCounts = useCallback(async () => {
    if (!user) return;
    try {
      const [cart, wishlist] = await Promise.all([
        api.get("/cart/"),
        api.get("/wishlist/"),
      ]);
      setCartCount(
        cart.data.items.reduce((total, item) => total + item.quantity, 0),
      );
      setWishlistCount(wishlist.data.items.length);
    } catch {
      setCartCount(0);
      setWishlistCount(0);
    }
  }, [user]);

  useEffect(() => {
    if (!localStorage.getItem("access_token")) return;
    api
      .get("/auth/me")
      .then(({ data }) => setUser(data))
      .catch((error) => {
        if (error.response?.status === 401)
          localStorage.removeItem("access_token");
        setCartCount(0);
        setWishlistCount(0);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshCounts(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshCounts]);

  const login = useCallback((token, userData) => {
    localStorage.setItem("access_token", token);
    setUser(userData);
  }, []);
  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setUser(null);
    setCartCount(0);
    setWishlistCount(0);
  }, []);
  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: Boolean(user),
    cartCount,
    wishlistCount,
    refreshCounts,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
