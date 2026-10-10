import { useContext, useEffect, useState } from "react";
import { Heart, Star } from "lucide-react";
import { Link } from "react-router-dom";

import api from "../services/api";
import useAuth from "../context/useAuth";
import { SiteBrandingContext } from "../context/site-branding-context";
import { Price } from "./Storefront";

const NOTICE_DURATION_MS = 3500;

function getBrandName(product) {
  if (typeof product.brand === "string") {
    return product.brand;
  }

  return product.brand?.name ?? product.brand_name ?? "";
}

function getStock(product) {
  const value =
    product.available_stock ?? product.stock;

  if (value == null) return null;

  const stock = Number(value);

  return Number.isFinite(stock) ? stock : null;
}

function getErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;

  return typeof detail === "string" && detail
    ? detail
    : fallback;
}

function ProductCard({ product, imageUrl }) {
  const { siteName = "TerraLens" } =
    useContext(SiteBrandingContext);

  const {
    isAuthenticated,
    refreshCounts,
  } = useAuth();

  const [savedState, setSavedState] =
    useState(false);

  const [pending, setPending] =
    useState(false);

  const [notice, setNotice] =
    useState("");

  // Never show a saved state while logged out.
  const saved =
    isAuthenticated && savedState;

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let cancelled = false;

    const checkWishlist = async () => {
      try {
        const response =
          await api.get("/wishlist/");

        const wishlistItems =
          response.data?.items || [];

        const alreadySaved =
          wishlistItems.some(
            (item) =>
              String(item.product_id) ===
              String(product.id),
          );

        if (!cancelled) {
          setSavedState(alreadySaved);
        }
      } catch {
        // Ignore wishlist check errors.
      }
    };

    checkWishlist();

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    product.id,
  ]);

  useEffect(() => {
    if (!notice) return undefined;

    const timer = window.setTimeout(
      () => setNotice(""),
      NOTICE_DURATION_MS,
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  const stock = getStock(product);

  const rating = Number(
    product.rating || 0,
  );

  const brand =
    getBrandName(product) || siteName;

  const toggleWishlist = async () => {
    if (!isAuthenticated) {
      setNotice(
        "Sign in to save products.",
      );
      return;
    }

    if (pending) return;

    setPending(true);

    try {
      if (saved) {
        await api.delete(
          `/wishlist/${product.id}`,
        );

        setSavedState(false);

        setNotice(
          "Removed from wishlist.",
        );
      } else {
        await api.post(
          `/wishlist/${product.id}`,
        );

        setSavedState(true);

        setNotice(
          "Saved to wishlist.",
        );
      }
    } catch (error) {
      setNotice(
        getErrorMessage(
          error,
          "Unable to update wishlist.",
        ),
      );
      return;
    } finally {
      setPending(false);
    }

    try {
      await refreshCounts();
    } catch {
      // Wishlist update succeeded.
      // A stale header badge is not an error.
    }
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[#E3E5DF] bg-white transition hover:-translate-y-1 hover:shadow-[0_12px_30px_-24px_#1f2521]">
      <button
        type="button"
        onClick={toggleWishlist}
        disabled={pending}
        aria-label={`${saved ? "Remove" : "Add"} ${
          product.name
        } ${saved ? "from" : "to"} wishlist`}
        className={`absolute right-3 top-3 z-10 cursor-pointer rounded-full border p-2 transition focus:outline-none focus:ring-2 focus:ring-[#2874F0] focus:ring-offset-2 disabled:cursor-wait disabled:opacity-70 ${
          saved
            ? "border-[#2874F0] bg-[#2874F0] text-white hover:bg-[#1f63d1]"
            : "border-[#E3E5DF] bg-white text-[#486B57] hover:bg-[#DCE7DE]"
        }`}
      >
        <Heart
          size={17}
          fill={
            saved
              ? "currentColor"
              : "none"
          }
          aria-hidden="true"
        />
      </button>

      <Link
        to={`/products/${product.id}`}
        className="block cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#486B57] focus:ring-inset"
      >
        <div className="aspect-[4/3] overflow-hidden bg-[#F0F1EC]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-end bg-[radial-gradient(ellipse_at_25%_25%,white_0,transparent_55%),linear-gradient(140deg,#edf0e9,#dfe7dc)] p-5">
              <span className="text-xs uppercase tracking-[.18em] text-[#738078]">
                {siteName} collection
              </span>
            </div>
          )}
        </div>

        <div className="p-4">
          <p className="text-[11px] font-medium uppercase tracking-[.14em] text-[#737A74]">
            {brand}
          </p>

          <h3 className="mt-1 min-h-12 font-medium leading-6 hover:text-[#486B57]">
            {product.name}
          </h3>

          {rating > 0 && (
            <div className="mt-2 flex items-center gap-1 text-[#486B57]">
              <Star
                size={14}
                fill="currentColor"
                aria-hidden="true"
              />

              <span className="text-xs text-[#737A74]">
                <span className="sr-only">
                  Rated{" "}
                </span>
                {rating.toFixed(1)}
              </span>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <Price
              value={product.price}
              className="font-semibold"
            />

            {stock !== null && (
              <span
                className={`text-xs ${
                  stock > 0
                    ? "text-[#486B57]"
                    : "text-[#9a5547]"
                }`}
              >
                {stock > 0
                  ? "In stock"
                  : "Sold out"}
              </span>
            )}
          </div>
        </div>
      </Link>

      <p
        role="status"
        aria-live="polite"
        className={
          notice
            ? "px-4 pb-3 text-xs text-[#737A74]"
            : "sr-only"
        }
      >
        {notice}
      </p>
    </article>
  );
}

export default ProductCard;