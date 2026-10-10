import { useContext, useState } from "react";
import { Link } from "react-router-dom";

import { SiteBrandingContext } from "../context/site-branding-context";

function BrandMark({
  className = "",
  imageClassName = "h-9 max-w-40 object-contain",
  nameClassName = "text-[1.45rem] font-semibold tracking-tight text-[#486B57]",
  logoType = "navbar",
  alwaysShowName = false,
  fallbackLogo = false,
}) {
  const branding = useContext(SiteBrandingContext) || {};

  const { siteName = "TerraLens" } = branding;

  const logoUrl =
    logoType === "footer"
      ? branding.footerLogoUrl || branding.logoUrl
      : branding.logoUrl;

  const displayLogo = logoUrl || (fallbackLogo ? "/favicon.svg" : null);

  const [failedLogo, setFailedLogo] = useState(null);

  const showLogo = Boolean(displayLogo) && failedLogo !== displayLogo;
  const showName = !showLogo || alwaysShowName;

  return (
    <Link
      to="/"
      aria-label={`${siteName} home`}
      className={`inline-flex items-center focus:outline-none focus:ring-2 focus:ring-[#486B57] focus:ring-offset-2 ${className}`}
    >
      {showLogo && (
        <img
          src={displayLogo}
          alt={showName ? "" : `${siteName} logo`}
          className={imageClassName}
          onError={() => setFailedLogo(displayLogo)}
        />
      )}

      {showName && <span className={nameClassName}>{siteName}</span>}
    </Link>
  );
}

export default BrandMark;