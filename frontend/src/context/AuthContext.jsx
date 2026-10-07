import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../services/api";
import AuthContext from "./auth-context";
import {
  clearLegacySharedToken,
  getActiveSessionRole,
  getSessionToken,
  removeSessionToken,
  setSessionToken,
} from "./auth-context";

function AuthProvider({ children }) {
  const { pathname } = useLocation();
  const activeRole = getActiveSessionRole(pathname);

  const [customerUser, setCustomerUser] = useState(null);
  const [adminUser, setAdminUser] = useState(null);

  const [customerLoading, setCustomerLoading] = useState(() =>
    Boolean(getSessionToken("customer")),
  );

  const [adminLoading, setAdminLoading] = useState(() =>
    Boolean(getSessionToken("admin")),
  );

  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    clearLegacySharedToken();

    const restoreSession = async (role, setUser, setLoading) => {
      const token = getSessionToken(role);

      if (!token) {
        if (mounted) {
          setLoading(false);
        }

        return;
      }

      try {
        const { data } = await api.get("/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (mounted) {
          setUser(data);
        }
      } catch (error) {
        if (error.response?.status === 401) {
          removeSessionToken(role);
        }

        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    Promise.all([
      restoreSession(
        "customer",
        setCustomerUser,
        setCustomerLoading,
      ),
      restoreSession(
        "admin",
        setAdminUser,
        setAdminLoading,
      ),
    ]);

    return () => {
      mounted = false;
    };
  }, []);

  const user = activeRole === "admin"
    ? adminUser
    : customerUser;

  const loading = activeRole === "admin"
    ? adminLoading
    : customerLoading;

  const refreshCounts = useCallback(async () => {
    if (!customerUser || activeRole !== "customer") {
      return;
    }

    try {
      const [cart, wishlist] = await Promise.all([
        api.get("/cart/"),
        api.get("/wishlist/"),
      ]);

      setCartCount(
        cart.data.items.reduce(
          (total, item) => total + item.quantity,
          0,
        ),
      );

      setWishlistCount(
        wishlist.data.items.length,
      );
    } catch {
      setCartCount(0);
      setWishlistCount(0);
    }
  }, [activeRole, customerUser]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => void refreshCounts(),
      0,
    );

    return () => window.clearTimeout(timer);
  }, [refreshCounts]);

  const login = useCallback(
    (token, userData, role, remember = false) => {
      const sessionRole =
        role === "admin" ? "admin" : "customer";

      setSessionToken(
        sessionRole,
        token,
        remember,
      );

      if (sessionRole === "admin") {
        setAdminUser(userData);
        setAdminLoading(false);
      } else {
        setCustomerUser(userData);
        setCustomerLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(
    (role = activeRole) => {
      removeSessionToken(role);

      if (role === "admin") {
        setAdminUser(null);
        setAdminLoading(false);
      } else {
        setCustomerUser(null);
        setCustomerLoading(false);
        setCartCount(0);
        setWishlistCount(0);
      }
    },
    [activeRole],
  );
  
  const updateUser = useCallback(
    (updatedUser) => {
      if (activeRole === "admin") {
        setAdminUser(updatedUser);
      } else {
        setCustomerUser(updatedUser);
      }
    },
    [activeRole],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      updateUser,
      isAuthenticated: Boolean(user),
      cartCount,
      wishlistCount,
      refreshCounts,
    }),
    [
      user,
      loading,
      login,
      logout,
      updateUser,
      cartCount,
      wishlistCount,
      refreshCounts,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;