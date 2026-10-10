import { useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SiteBrandingContext } from "../context/site-branding-context";
import { resolveMediaUrl } from "../services/api";

const DEFAULT_DESCRIPTION =
  "Shop quality products with trusted service, secure checkout, and reliable delivery.";

const DEFAULT_OG_IMAGE = "/og-default.png"; // 1200x630 PNG in /public

const SITE_URL = (import.meta.env?.VITE_SITE_URL || "").replace(/\/+$/, "");

function toAbsoluteUrl(url, base) {
  if (!url) return "";

  try {
    return new URL(url, base).href;
  } catch {
    return "";
  }
}

function setMetaTag(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);

  if (!content) {
    if (element) element.remove();
    return;
  }

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setCanonical(url) {
  let link = document.head.querySelector('link[rel="canonical"]');

  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }

  link.href = url;
}

function removeStructuredData() {
  const existing = document.head.querySelector(
    'script[data-seo="structured-data"]',
  );

  if (existing) existing.remove();
}

function setStructuredData(json) {
  removeStructuredData();

  if (!json) return;

  const script = document.createElement("script");

  script.type = "application/ld+json";
  script.dataset.seo = "structured-data";
  script.textContent = json;

  document.head.appendChild(script);
}

function SEO({
  title = "",
  description = DEFAULT_DESCRIPTION,
  image = "",
  type = "website",
  noIndex = false,
  structuredData = null,
}) {
  const branding = useContext(SiteBrandingContext) ?? {};
  const { pathname } = useLocation();

  const siteName = branding.siteName || "TerraLens";
  const heroImageUrl = branding.heroImageUrl || "";

  const structuredDataJson = structuredData
    ? JSON.stringify(structuredData)
    : "";

  useEffect(() => {
    const baseUrl = SITE_URL || window.location.origin;

    const pageTitle = title ? `${title} | ${siteName}` : siteName;

    const canonicalUrl = `${baseUrl}${pathname}`;

    const imageUrl =
      toAbsoluteUrl(
        image
          ? resolveMediaUrl(image)
          : heroImageUrl
            ? resolveMediaUrl(heroImageUrl)
            : DEFAULT_OG_IMAGE,
        baseUrl,
      ) || `${baseUrl}${DEFAULT_OG_IMAGE}`;

    document.title = pageTitle;

    setMetaTag("name", "description", description);
    setMetaTag("name", "robots", noIndex ? "noindex,nofollow" : "index,follow");

    setMetaTag("property", "og:title", pageTitle);
    setMetaTag("property", "og:description", description);
    setMetaTag("property", "og:type", type);
    setMetaTag("property", "og:url", canonicalUrl);
    setMetaTag("property", "og:site_name", siteName);
    setMetaTag("property", "og:image", imageUrl);

    setMetaTag("name", "twitter:card", "summary_large_image");
    setMetaTag("name", "twitter:title", pageTitle);
    setMetaTag("name", "twitter:description", description);
    setMetaTag("name", "twitter:image", imageUrl);

    setCanonical(canonicalUrl);
    setStructuredData(structuredDataJson);

    return () => {
      removeStructuredData();
      setMetaTag("name", "robots", "index,follow");
    };
  }, [
    title,
    description,
    image,
    type,
    noIndex,
    structuredDataJson,
    siteName,
    heroImageUrl,
    pathname,
  ]);

  return null;
}

export default SEO;