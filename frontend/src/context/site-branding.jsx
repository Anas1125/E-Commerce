import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../services/api";
import { SiteBrandingContext } from "./site-branding-context";

export function SiteBrandingProvider({ children }) {
  const [settings, setSettings] = useState({});

  const refreshBranding = useCallback(async () => {
    try {
      const response = await api.get("/site-settings/");
      setSettings(response.data);
      return response.data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => refreshBranding(), 0);

    return () => clearTimeout(timer);
  }, [refreshBranding]);

  const faviconUrl = settings.favicon_url || null;

  useEffect(() => {
    const icon =
      document.querySelector('link[rel~="icon"]') ||
      document.createElement("link");

    icon.rel = "icon";
    icon.href = faviconUrl || "/favicon.svg";

    const extension = faviconUrl
      ?.split("?")[0]
      .split(".")
      .pop()
      ?.toLowerCase();

    icon.type =
      extension === "ico"
        ? "image/x-icon"
        : extension === "png"
          ? "image/png"
          : extension === "webp"
            ? "image/webp"
            : "image/svg+xml";

    if (!icon.parentNode) {
      document.head.appendChild(icon);
    }
  }, [faviconUrl]);

  const value = useMemo(
    () => ({
      logoUrl: settings.navbar_logo_url || null,
      heroImageUrl: settings.hero_image_url || null,
      footerLogoUrl: settings.footer_logo_url || null,
      faviconUrl,
      siteName: settings.site_name || "TerraLens",

      refreshBranding,
    }),
    [settings, faviconUrl, refreshBranding],
  );

  return (
    <SiteBrandingContext.Provider value={value}>
      {children}
    </SiteBrandingContext.Provider>
  );
}