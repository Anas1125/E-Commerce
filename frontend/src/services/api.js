import axios from "axios";
import { getActiveSessionRole, getSessionToken } from "../context/auth-context";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const resolveMediaUrl = (url) => {
  if (!url) return "";

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const isLoginRequest = /\/auth\/(login|register)(\?|$)/.test(config.url || "");
  const token = isLoginRequest ? null : getSessionToken(getActiveSessionRole());

  // Preserve an explicit token used to fetch /auth/me immediately after login.
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
