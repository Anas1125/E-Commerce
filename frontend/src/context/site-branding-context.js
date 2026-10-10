import { createContext } from "react";

export const SiteBrandingContext = createContext({
  logoUrl: null,
  heroImageUrl: null,
  footerLogoUrl: null,
  faviconUrl: null,
  siteName: "TerraLens",
  loading: false,
  refreshBranding: async () => {},
});