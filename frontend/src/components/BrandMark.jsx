import { Link } from "react-router-dom";
import { useContext } from "react";
import { SiteBrandingContext } from "../context/site-branding-context";

function BrandMark({
  className = "",
  imageClassName = "h-9 max-w-40 object-contain",
  nameClassName = "text-[1.45rem] font-semibold tracking-tight text-[#486B57]",
  logoType = "navbar",
  alwaysShowName = false,
  fallbackLogo = false,
}) {
  const branding = useContext(SiteBrandingContext);
  const logoUrl =
    logoType === "footer"
      ? branding.footerLogoUrl || branding.logoUrl
      : branding.logoUrl;
  const displayLogo = logoUrl || (fallbackLogo ? "/favicon.svg" : null);
  const { siteName = "TerraLens" } = branding;
  return (
    <Link
      to="/"
      aria-label={`${siteName} home`}
      className={`inline-flex items-center ${className}`}
    >
      {displayLogo ? (
        <img
          src={displayLogo}
          alt={`${siteName} logo`}
          className={imageClassName}
          onError={(event) => {
            event.currentTarget.hidden = true;
            if (!alwaysShowName) event.currentTarget.nextSibling.hidden = false;
          }}
        />
      ) : null}
      <span
        hidden={Boolean(displayLogo) && !alwaysShowName}
        className={nameClassName}
      >
        {siteName}
      </span>
    </Link>
  );
}
export default BrandMark;
