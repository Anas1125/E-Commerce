import { createContext } from "react";

const sessionKeys = {
  customer: "customer_access_token",
  admin: "admin_access_token",
};

function isValidRole(role) {
  return role === "customer" || role === "admin";
}

export function getSessionKey(role) {
  return isValidRole(role) ? sessionKeys[role] : null;
}

function readStorage(type, key) {
  try {
    return window[type].getItem(key);
  } catch {
    return null;
  }
}

function removeFromStorage(type, key) {
  try {
    window[type].removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

export function getSessionToken(role) {
  const key = getSessionKey(role);

  if (!key) return null;

  return (
    readStorage("localStorage", key) ||
    readStorage("sessionStorage", key) ||
    null
  );
}

export function setSessionToken(role, token, remember = false) {
  const key = getSessionKey(role);

  if (!key || typeof token !== "string" || !token.trim()) return false;

  // Remove any previous copy first.
  removeFromStorage("localStorage", key);
  removeFromStorage("sessionStorage", key);

  if (remember) {
    try {
      window.localStorage.setItem(key, token);
      return true;
    } catch {
      // Fall through and keep the session in sessionStorage instead.
    }
  }

  try {
    window.sessionStorage.setItem(key, token);
    return true;
  } catch {
    return false;
  }
}

export function removeSessionToken(role) {
  const key = getSessionKey(role);

  if (!key) return;

  removeFromStorage("localStorage", key);
  removeFromStorage("sessionStorage", key);
}

export function clearLegacySharedToken() {
  removeFromStorage("localStorage", "access_token");
  removeFromStorage("sessionStorage", "access_token");
}

export function getActiveSessionRole(pathname = window.location.pathname) {
  const path = pathname.toLowerCase();

  return path === "/admin" || path.startsWith("/admin/") ? "admin" : "customer";
}

const AuthContext = createContext({
  user: null,
  loading: true,
  sessionError: false,
  login: () => {},
  logout: () => {},
  updateUser: () => {},
  isAuthenticated: false,
  cartCount: 0,
  wishlistCount: 0,
  refreshCounts: async () => {},
});

export default AuthContext;