import { useContext, useEffect } from "react";
import { SiteBrandingContext } from "../context/site-branding-context";
import { resolveMediaUrl } from "../services/api";

const DEFAULT_DESCRIPTION =
  "Shop quality products with trusted service, secure checkout, and reliable delivery.";

function setMetaTag(attribute, key, content) {
  if (!content) return;

  let element = document.head.querySelector(
    `meta[${attribute}="${key}"]`,
  );

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setCanonical(url) {
  let link = document.head.querySelector(
    'link[rel="canonical"]',
  );

  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }

  link.href = url;
}

function setStructuredData(data) {
  const existing = document.head.querySelector(
    'script[data-seo="structured-data"]',
  );

  if (existing) {
    existing.remove();
  }

  if (!data) return;

  const script = document.createElement("script");

  script.type = "application/ld+json";
  script.dataset.seo = "structured-data";
  script.textContent = JSON.stringify(data);

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
  const branding = useContext(SiteBrandingContext);

  const siteName = branding.siteName || "TerraLens";

  useEffect(() => {
    const pageTitle = title
      ? `${title} | ${siteName}`
      : siteName;

    document.title = pageTitle;

    const canonicalUrl =
      `${window.location.origin}${window.location.pathname}`;

    const imageUrl = image
      ? resolveMediaUrl(image)
      : branding.heroImageUrl
        ? resolveMediaUrl(branding.heroImageUrl)
        : `${window.location.origin}/favicon.svg`;

    setMetaTag(
      "name",
      "description",
      description,
    );

    setMetaTag(
      "name",
      "robots",
      noIndex
        ? "noindex,nofollow"
        : "index,follow",
    );

    setMetaTag(
      "property",
      "og:title",
      pageTitle,
    );

    setMetaTag(
      "property",
      "og:description",
      description,
    );

    setMetaTag(
      "property",
      "og:type",
      type,
    );

    setMetaTag(
      "property",
      "og:url",
      canonicalUrl,
    );

    setMetaTag(
      "property",
      "og:site_name",
      siteName,
    );

    setMetaTag(
      "property",
      "og:image",
      imageUrl,
    );

    setMetaTag(
      "name",
      "twitter:card",
      "summary_large_image",
    );

    setMetaTag(
      "name",
      "twitter:title",
      pageTitle,
    );

    setMetaTag(
      "name",
      "twitter:description",
      description,
    );

    setMetaTag(
      "name",
      "twitter:image",
      imageUrl,
    );

    setCanonical(canonicalUrl);

    setStructuredData(structuredData);
  }, [
    title,
    description,
    image,
    type,
    noIndex,
    structuredData,
    siteName,
    branding.heroImageUrl,
  ]);

  return null;
}

export default SEO;