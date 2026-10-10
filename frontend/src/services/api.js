import axios from "axios";
import { getActiveSessionRole, getSessionToken } from "../context/auth-context";

const DEFAULT_API_BASE_URL = "http://localhost:8000";
const REQUEST_TIMEOUT_MS = 15000;

// Trailing slashes are stripped so we never build URLs like https://api.example.com//api
const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).trim();
const secureProductionApiBaseUrl =
  import.meta.env.PROD && import.meta.env.VITE_API_BASE_URL
    ? configuredApiBaseUrl.replace(/^http:\/\//i, "https://")
    : configuredApiBaseUrl;

export const API_BASE_URL = secureProductionApiBaseUrl.replace(/\/+$/, "");

if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
  console.error(
    "VITE_API_BASE_URL is not set. This production build is calling " +
      `${DEFAULT_API_BASE_URL}, so API requests will fail.`,
  );
}

export const resolveMediaUrl = (url) => {
  if (!url) return "";

  if (/^(https?:|blob:|data:)/i.test(url) || url.startsWith("//")) {
    if (import.meta.env.PROD && /^http:\/\//i.test(url)) {
      return url.replace(/^http:\/\//i, "https://");
    }
    return url;
  }

  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

let unauthorizedHandler = null;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: REQUEST_TIMEOUT_MS,
});

api.interceptors.request.use((config) => {
  const isLoginRequest = /\/auth\/(login|register)(\?|$)/.test(config.url || "");
  const role = getActiveSessionRole();
  const token = isLoginRequest ? null : getSessionToken(role);

  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;

    config.sessionRole = role;
    config.sessionToken = token;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { sessionRole, sessionToken } = error.config || {};

    if (
      error.response?.status === 401 &&
      sessionToken &&
      getSessionToken(sessionRole) === sessionToken
    ) {
      unauthorizedHandler?.(sessionRole);
    }

    return Promise.reject(error);
  },
);

export default api;