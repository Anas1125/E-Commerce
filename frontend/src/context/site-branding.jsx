import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { resolveMediaUrl } from "../services/api";
import { SiteBrandingContext } from "./site-branding-context";

const DEFAULT_FAVICON = "/favicon.svg";

const FAVICON_TYPES = {
  ico: "image/x-icon",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
};

function getFaviconType(url) {
  const extension = url
    .split("#")[0]
    .split("?")[0]
    .split(".")
    .pop()
    ?.toLowerCase();

  return FAVICON_TYPES[extension] || "";
}

function normalizeSettings(data) {
  return data && typeof data === "object" ? data : {};
}

export function SiteBrandingProvider({ children }) {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  const requestId = useRef(0);

  const refreshBranding = useCallback(async () => {
    const id = ++requestId.current;

    try {
      const response = await api.get("/site-settings");
      const data = normalizeSettings(response.data);

      if (id === requestId.current) {
        setSettings(data);
      }

      return data;
    } catch {
      // Keep whatever settings we already have
      return null;
    } finally {
      if (id === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const id = ++requestId.current;

    api
      .get("/site-settings/")
      .then((response) => {
        if (id === requestId.current) {
          setSettings(normalizeSettings(response.data));
        }
      })
      .catch(() => {
        // Keep defaults if the first load fails
      })
      .finally(() => {
        if (id === requestId.current) {
          setLoading(false);
        }
      });

    return () => {
      requestId.current += 1;
    };
  }, []);

  const faviconUrl = settings.favicon_url || null;

  useEffect(() => {
    const icons = document.head.querySelectorAll('link[rel~="icon"]');
    const icon = icons[0] || document.createElement("link");

    icons.forEach((element, index) => {
      if (index > 0) element.remove();
    });

    const href =
      (faviconUrl ? resolveMediaUrl(faviconUrl) : "") || DEFAULT_FAVICON;
    const type = getFaviconType(href);

    icon.rel = "icon";
    icon.href = href;

    if (type) {
      icon.type = type;
    } else {
      icon.removeAttribute("type");
    }

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
      loading,
      refreshBranding,
    }),
    [settings, faviconUrl, loading, refreshBranding],
  );

  return (
    <SiteBrandingContext.Provider value={value}>
      {children}
    </SiteBrandingContext.Provider>
  );
}