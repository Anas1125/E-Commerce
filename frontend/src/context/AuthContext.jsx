import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api, { setUnauthorizedHandler } from "../services/api";
import AuthContext, {
  clearLegacySharedToken,
  getActiveSessionRole,
  getSessionKey,
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

  const [sessionErrors, setSessionErrors] = useState({
    customer: false,
    admin: false,
  });

  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  const countsRequestId = useRef(0);

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
        } else if (mounted) {
          setSessionErrors((current) => ({ ...current, [role]: true }));
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
      restoreSession("customer", setCustomerUser, setCustomerLoading),
      restoreSession("admin", setAdminUser, setAdminLoading),
    ]);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.storageArea !== window.localStorage) return;

      const clearedAll = event.key === null;

      if (
        clearedAll ||
        (event.key === getSessionKey("customer") && !event.newValue)
      ) {
        countsRequestId.current += 1;
        setCustomerUser(null);
        setCartCount(0);
        setWishlistCount(0);
      }

      if (
        clearedAll ||
        (event.key === getSessionKey("admin") && !event.newValue)
      ) {
        setAdminUser(null);
      }
    };

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const user = activeRole === "admin" ? adminUser : customerUser;
  const loading = activeRole === "admin" ? adminLoading : customerLoading;
  const sessionError =
    sessionErrors[activeRole === "admin" ? "admin" : "customer"];

  const refreshCounts = useCallback(async () => {
    if (!customerUser || activeRole !== "customer") {
      return;
    }

    const requestId = ++countsRequestId.current;

    try {
      const [cart, wishlist] = await Promise.all([
        api.get("/cart/"),
        api.get("/wishlist/"),
      ]);

      if (requestId !== countsRequestId.current) return;

      setCartCount(
        cart.data.items.reduce((total, item) => total + item.quantity, 0),
      );

      setWishlistCount(wishlist.data.items.length);
    } catch (error) {
      if (requestId !== countsRequestId.current) return;

      if (error.response?.status === 401) {
        setCartCount(0);
        setWishlistCount(0);
      }
    }
  }, [activeRole, customerUser]);

  const login = useCallback((token, userData, role, remember = false) => {
    const sessionRole = role === "admin" ? "admin" : "customer";

    setSessionToken(sessionRole, token, remember);
    setSessionErrors((current) => ({ ...current, [sessionRole]: false }));

    if (sessionRole === "admin") {
      setAdminUser(userData);
      setAdminLoading(false);
    } else {
      setCustomerUser(userData);
      setCustomerLoading(false);
    }
  }, []);

  const logout = useCallback(
    (role) => {
      const target =
        role === "admin" || role === "customer" ? role : activeRole;

      removeSessionToken(target);
      setSessionErrors((current) => ({ ...current, [target]: false }));

      if (target === "admin") {
        setAdminUser(null);
        setAdminLoading(false);
      } else {
        countsRequestId.current += 1;

        setCustomerUser(null);
        setCustomerLoading(false);
        setCartCount(0);
        setWishlistCount(0);
      }
    },
    [activeRole],
  );

  useEffect(() => {
    setUnauthorizedHandler((role) => logout(role));

    return () => setUnauthorizedHandler(null);
  }, [logout]);

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
      sessionError,
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
      sessionError,
      login,
      logout,
      updateUser,
      cartCount,
      wishlistCount,
      refreshCounts,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;