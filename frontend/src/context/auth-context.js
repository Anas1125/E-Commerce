import { createContext } from "react";

const sessionKeys = {
  customer: "customer_access_token",
  admin: "admin_access_token",
};

export function getSessionToken(role) {
  try {
    const key = sessionKeys[role];

    return (
      window.localStorage.getItem(key) ||
      window.sessionStorage.getItem(key)
    );
  } catch {
    return null;
  }
}

export function setSessionToken(role, token, remember = false) {
  const key = sessionKeys[role];

  try {
    // Remove any previous copy first.
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);

    if (remember) {
      window.localStorage.setItem(key, token);
    } else {
      window.sessionStorage.setItem(key, token);
    }
  } catch {
    // If localStorage/sessionStorage access fails,
    // keep the session in sessionStorage when possible.
    try {
      window.sessionStorage.setItem(key, token);
    } catch {
      // Ignore storage errors.
    }
  }
}

export function removeSessionToken(role) {
  const key = sessionKeys[role];

  try {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

export function clearLegacySharedToken() {
  try {
    window.localStorage.removeItem("access_token");
    window.sessionStorage.removeItem("access_token");
  } catch {
    // Ignore storage errors.
  }
}

export function getActiveSessionRole(pathname = window.location.pathname) {
  return pathname === "/admin" || pathname.startsWith("/admin/")
    ? "admin"
    : "customer";
}

const AuthContext = createContext({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  cartCount: 0,
  wishlistCount: 0,
  refreshCounts: async () => {},
});

export default AuthContext;