import { useContext, useEffect, useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  Truck,
  ArrowRight,
} from "lucide-react";

import api from "../services/api";
import { getActiveDiscounts, getProductPriceDetails } from "../services/pricing";
import ProductCard from "../components/ProductCard";
import useAuth from "../context/useAuth";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

import {
  LoadingState,
  Price,
} from "../components/Storefront";

const NETWORK_ERROR =
  "Network problem. Check your connection and try again.";

const getErrorMessage = (error, fallback) => {
  const detail = error.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  return error.response ? fallback : NETWORK_ERROR;
};

const pickPrimaryImage = (images) => {
  if (!Array.isArray(images)) {
    return null;
  }

  return (
    images.find((image) => image.is_primary)?.image_url ||
    images[0]?.image_url ||
    null
  );
};

const scoreProduct = (item, product) => {
  let score = 0;

  // Same category
  if (item.category_id === product.category_id) {
    score += 5;
  }

  // Same brand
  if (
    item.brand &&
    product.brand &&
    item.brand.toLowerCase() === product.brand.toLowerCase()
  ) {
    score += 4;
  }

  // Similar price
  const productPrice = Number(product.price);
  const itemPrice = Number(item.price);

  if (productPrice > 0) {
    const priceDifference =
      Math.abs(itemPrice - productPrice) / productPrice;

    if (priceDifference <= 0.2) {
      score += 3;
    } else if (priceDifference <= 0.4) {
      score += 1;
    }
  }

  // Rating
  score += Number(item.rating || 0) * 0.5;

  return score;
};

function ProductDetailsContent({ id }) {
  const { siteName = "TerraLens" } =
    useContext(SiteBrandingContext) || {};

  const {
    isAuthenticated,
    loading: authLoading,
    refreshCounts,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [savedRaw, setSavedRaw] = useState(false);

  const [reviewsError, setReviewsError] = useState("");
  const [reviews, setReviews] = useState([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1);

  const [suggestedProducts, setSuggestedProducts] = useState([]);
  const [suggestedImages, setSuggestedImages] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsReloadKey, setReviewsReloadKey] = useState(0);

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [message, setMessage] = useState(null); // { text, type }
  const [activeDiscounts, setActiveDiscounts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getActiveDiscounts()
      .then((discounts) => { if (!cancelled) setActiveDiscounts(discounts); })
      .catch(() => { if (!cancelled) setActiveDiscounts([]); });
    return () => { cancelled = true; };
  }, []);

  const productId = product?.id;
  const priceDetails = getProductPriceDetails(product, activeDiscounts);
  const saved = isAuthenticated && savedRaw;

  useEffect(() => {
    let cancelled = false;

    const fetchProduct = async () => {
      try {
        const response = await api.get(`/products/${id}`);

        if (cancelled) {
          return;
        }

        if (response.data?.is_active === false) {
          setProduct(null);
          setNotFound(true);
        } else {
          setProduct(response.data);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Failed to load product:", error);

        setProduct(null);

        if (error.response?.status === 404) {
          setNotFound(true);
        } else {
          setLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProduct();

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  useEffect(() => {
    if (!productId) {
      return;
    }

    let cancelled = false;

    const fetchImage = async () => {
      try {
        const images = await api.get(
          `/products/${productId}/images`,
        );

        if (!cancelled) {
          setImageUrl(pickPrimaryImage(images.data));
        }
      } catch {
        if (!cancelled) {
          setImageUrl(null);
        }
      }
    };

    fetchImage();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    if (!productId || authLoading) {
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadWishlistState = async () => {
      try {
        const { data } = await api.get("/wishlist/");

        if (cancelled) {
          return;
        }

        const items = Array.isArray(data?.items)
          ? data.items
          : [];

        setSavedRaw(
          items.some(
            (item) =>
              String(
                item.product_id ?? item.product?.id,
              ) === String(productId),
          ),
        );
      } catch {
        // Keep the heart empty if the wishlist can't be loaded.
      }
    };

    loadWishlistState();

    return () => {
      cancelled = true;
    };
  }, [productId, isAuthenticated, authLoading]);

  useEffect(() => {
    if (!productId) {
      return;
    }

    let cancelled = false;

    const fetchReviews = async () => {
      try {
        const response = await api.get(
          `/products/${productId}/reviews`,
          {
            params: {
              page: reviewsPage,
              page_size: 5,
            },
          },
        );

        if (cancelled) {
          return;
        }

        setReviews(response.data.reviews || []);
        setReviewsTotal(response.data.total || 0);
        setReviewsTotalPages(response.data.total_pages || 1);
        setReviewsError("");
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Failed to load reviews:", error);

        setReviews([]);
        setReviewsError(
          "Reviews are temporarily unavailable.",
        );
      } finally {
        if (!cancelled) {
          setReviewsLoading(false);
        }
      }
    };

    fetchReviews();

    return () => {
      cancelled = true;
    };
  }, [productId, reviewsPage, reviewsReloadKey]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setReviewsLoading(true);
        setReviewsReloadKey((key) => key + 1);
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, []);

  useEffect(() => {
    if (!product) {
      return;
    }

    let cancelled = false;

    const fetchSuggestedProducts = async () => {
      try {
        const response = await api.get("/products/");

        if (cancelled) {
          return;
        }

        const recommendations = response.data
          .filter((item) => item.id !== product.id)
          .map((item) => ({
            ...item,
            recommendationScore: scoreProduct(item, product),
          }))
          .sort(
            (a, b) =>
              b.recommendationScore - a.recommendationScore,
          )
          .slice(0, 4);

        setSuggestedProducts(recommendations);

        const imageResults = await Promise.all(
          recommendations.map(async (item) => {
            try {
              const images = await api.get(
                `/products/${item.id}/images`,
              );

              return [item.id, pickPrimaryImage(images.data)];
            } catch {
              return [item.id, null];
            }
          }),
        );

        if (cancelled) {
          return;
        }

        setSuggestedImages(
          Object.fromEntries(
            imageResults.filter(([, url]) => url),
          ),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "Failed to load suggested products:",
          error,
        );

        setSuggestedProducts([]);
        setSuggestedImages({});
      }
    };

    fetchSuggestedProducts();

    return () => {
      cancelled = true;
    };
  }, [product]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <LoadingState label="Loading product..." />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-16">
        <div className="mx-auto max-w-4xl rounded-md border border-[#E0E0E0] bg-white px-6 py-16 text-center">
          <h1 className="text-2xl font-bold text-[#212121]">
            Couldn’t load this product
          </h1>

          <p className="mt-2 text-sm text-[#878787]">
            Something went wrong while loading the product.
            Check your connection and try again.
          </p>

          <button
            type="button"
            onClick={() => {
              setLoadError(false);
              setLoading(true);
              setReloadKey((key) => key + 1);
            }}
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-6 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-16">
        <div className="mx-auto max-w-4xl rounded-md border border-[#E0E0E0] bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
            <ShoppingBag size={26} />
          </div>

          <h1 className="mt-6 text-2xl font-bold text-[#212121]">
            Product not found
          </h1>

          <p className="mt-2 text-sm text-[#878787]">
            The product you're looking for may have
            been removed or is no longer available.
          </p>

          <Link
            to="/shop"
            className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-6 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
          >
            <ArrowLeft size={16} />
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  const availableStock = Number(
    product.available_stock ?? product.stock ?? 0,
  );

  const outOfStock = availableStock <= 0;

  const safeQuantity = Math.max(
    1,
    Math.min(quantity, Math.max(availableStock, 1)),
  );

  const decreaseQuantity = () => {
    setMessage(null);
    setQuantity(Math.max(1, safeQuantity - 1));
  };

  const increaseQuantity = () => {
    setMessage(null);
    setQuantity(Math.min(availableStock, safeQuantity + 1));
  };

  const requireSignIn = () => {
    if (authLoading) {
      return false;
    }

    if (!isAuthenticated) {
      navigate("/login", {
        state: { from: location },
      });

      return false;
    }

    return true;
  };

  const handleWishlist = async () => {
    if (wishlistBusy || !requireSignIn()) {
      return;
    }

    setWishlistBusy(true);

    try {
      if (saved) {
        await api.delete(`/wishlist/${product.id}`);

        setSavedRaw(false);
        setMessage({
          text: "Removed from wishlist.",
          type: "success",
        });
      } else {
        await api.post(`/wishlist/${product.id}`);

        setSavedRaw(true);
        setMessage({
          text: "Saved to wishlist.",
          type: "success",
        });
      }

      await refreshCounts();
    } catch (error) {
      setMessage({
        text: getErrorMessage(
          error,
          "Unable to update wishlist.",
        ),
        type: "error",
      });
    } finally {
      setWishlistBusy(false);
    }
  };

  const handleAddToCart = async () => {
    if (adding || !requireSignIn()) {
      return;
    }

    setAdding(true);
    setMessage(null);

    try {
      await api.post("/cart/items", {
        product_id: product.id,
        quantity: safeQuantity,
      });

      setMessage({
        text: "Added to cart successfully.",
        type: "success",
      });

      await refreshCounts();
    } catch (error) {
      console.error(
        "Failed to add product to cart:",
        error,
      );

      if (error.response?.status === 401) {
        setMessage({
          text: "Your session expired. Please sign in again to add this product to your cart.",
          type: "error",
        });
      } else {
        setMessage({
          text: getErrorMessage(
            error,
            "Unable to add this product to your cart.",
          ),
          type: "error",
        });
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F3F6] pb-16">
      <SEO
        title={product.name}
        description={
          product.description ||
          `Shop ${product.name} at ${siteName}.`
        }
        image={imageUrl || ""}
        type="product"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description:
            product.description ||
            `Shop ${product.name} at ${siteName}.`,
          image: imageUrl ? [imageUrl] : undefined,
          brand: product.brand
            ? {
                "@type": "Brand",
                name: product.brand,
              }
            : undefined,
          offers: {
            "@type": "Offer",
            priceCurrency: "INR",
            price: priceDetails.discountedPrice.toFixed(2),
            availability: outOfStock
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
            url: window.location.href,
          },
          aggregateRating:
            Number(product.rating || 0) > 0 &&
            reviewsTotal > 0
              ? {
                  "@type": "AggregateRating",
                  ratingValue: Number(
                    product.rating,
                  ).toFixed(1),
                  reviewCount: reviewsTotal,
                }
              : undefined,
        }}
      />

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">

        {/* BREADCRUMB */}
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-[#878787]">
          <Link
            to="/"
            className="cursor-pointer hover:text-[#2874F0]"
          >
            Home
          </Link>

          <span>/</span>

          <Link
            to="/shop"
            className="cursor-pointer hover:text-[#2874F0]"
          >
            Shop
          </Link>

          <span>/</span>

          <span className="max-w-[250px] truncate text-[#555]">
            {product.name}
          </span>
        </div>

        {/* PRODUCT SECTION */}
        <section className="grid gap-0 overflow-hidden rounded-md border border-[#E0E0E0] bg-white lg:grid-cols-2">

          {/* IMAGE */}
          <div className="relative border-b border-[#E0E0E0] lg:border-b-0 lg:border-r">

            <button
              type="button"
              onClick={handleWishlist}
              disabled={wishlistBusy}
              aria-label={
                saved
                  ? "Remove from wishlist"
                  : "Add to wishlist"
              }
              className={`absolute right-5 top-5 z-10 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border bg-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
                saved
                  ? "border-[#2874F0] text-[#2874F0]"
                  : "border-[#E0E0E0] text-[#555] hover:border-[#2874F0] hover:text-[#2874F0]"
              }`}
            >
              <Heart
                size={20}
                fill={saved ? "currentColor" : "none"}
              />
            </button>

            <div className="flex aspect-square items-center justify-center bg-white p-8 sm:p-12">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#F7F8FA]">
                  <span className="text-sm text-[#878787]">
                    Image coming soon
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* INFORMATION */}
          <div className="p-6 sm:p-8">

            {/* BRAND */}
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2874F0]">
              {product.brand || siteName}
            </p>

            {/* TITLE */}
            <h1 className="mt-2 text-2xl font-bold leading-tight text-[#212121] sm:text-3xl">
              {product.name}
            </h1>

            {/* RATING */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-1 rounded-md bg-[#388E3C] px-2 py-1 text-xs font-bold !text-white">
                {Number(product.rating || 0).toFixed(1)}

                <Star size={12} fill="currentColor" />
              </div>

              <span className="text-sm text-[#878787]">
                {reviewsTotal}{" "}
                {reviewsTotal === 1 ? "review" : "reviews"}
              </span>
            </div>

            {/* PRICE */}
            <div className="mt-5 border-b border-[#E0E0E0] pb-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <Price
                  value={priceDetails.discountedPrice}
                  className="text-3xl font-bold text-[#212121]"
                />
                {priceDetails.discountAmount > 0 && (
                  <>
                    <Price value={priceDetails.originalPrice} className="text-base text-[#878787] line-through" />
                    <span className="rounded bg-[#E8F5E9] px-2 py-1 text-xs font-bold text-[#2E7D32]">{priceDetails.label}</span>
                  </>
                )}
              </div>

              <p className="mt-1 text-xs text-[#878787]">
                Inclusive of applicable taxes
              </p>
            </div>

            {/* DESCRIPTION */}
            <div className="mt-5">
              <h2 className="text-sm font-bold text-[#212121]">
                Product Description
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#555]">
                {product.description ||
                  "No description available."}
              </p>
            </div>

            {/* STOCK */}
            <div className="mt-5">
              {outOfStock ? (
                <p className="text-sm font-bold text-[#D32F2F]">
                  Out of stock
                </p>
              ) : (
                <p className="inline-flex items-center gap-2 text-sm font-bold text-[#388E3C]">
                  <Check size={16} />
                  {availableStock} available
                </p>
              )}
            </div>

            {/* QUANTITY */}
            {!outOfStock && (
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <span className="text-sm font-semibold text-[#212121]">
                  Quantity
                </span>

                <div className="flex items-center overflow-hidden rounded-md border border-[#D0D0D0] bg-white">
                  <button
                    type="button"
                    onClick={decreaseQuantity}
                    disabled={safeQuantity <= 1}
                    aria-label="Decrease quantity"
                    className="flex h-10 w-10 cursor-pointer items-center justify-center text-[#212121] transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus size={15} />
                  </button>

                  <span
                    aria-live="polite"
                    className="flex h-10 w-12 items-center justify-center border-x border-[#D0D0D0] text-sm font-bold text-[#212121]"
                  >
                    {safeQuantity}
                  </span>

                  <button
                    type="button"
                    onClick={increaseQuantity}
                    disabled={safeQuantity >= availableStock}
                    aria-label="Increase quantity"
                    className="flex h-10 w-10 cursor-pointer items-center justify-center text-[#212121] transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* ACTIONS */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={outOfStock || adding}
                className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-6 py-3.5 text-sm font-bold !text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ShoppingBag size={18} />

                {adding
                  ? "Adding..."
                  : outOfStock
                    ? "Out of Stock"
                    : `Add ${safeQuantity} to Cart`}
              </button>

              <button
                type="button"
                onClick={handleWishlist}
                disabled={wishlistBusy}
                className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-6 py-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  saved
                    ? "border-[#2874F0] bg-[#F5F9FF] text-[#2874F0]"
                    : "border-[#D0D0D0] bg-white text-[#212121] hover:border-[#2874F0] hover:bg-[#F5F9FF] hover:text-[#2874F0]"
                }`}
              >
                <Heart
                  size={18}
                  fill={saved ? "currentColor" : "none"}
                />

                {saved ? "Saved" : "Wishlist"}
              </button>
            </div>

            {/* MESSAGE */}
            {message && (
              <div
                role="status"
                className={`mt-4 rounded-md px-4 py-3 text-sm ${
                  message.type === "success"
                    ? "bg-[#E8F5E9] text-[#388E3C]"
                    : "bg-[#FFF3E0] text-[#E65100]"
                }`}
              >
                {message.text}
              </div>
            )}

            {/* DELIVERY INFO */}
            <div className="mt-6 border-t border-[#E0E0E0] pt-5">
              <div className="flex gap-3">
                <Truck
                  size={20}
                  className="mt-0.5 shrink-0 text-[#2874F0]"
                />

                <div>
                  <p className="text-sm font-bold text-[#212121]">
                    Delivery information
                  </p>

                  <p className="mt-1 text-xs leading-5 text-[#878787]">
                    Delivery options and final shipping
                    charges are confirmed during checkout.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* REVIEWS */}
        <section className="mt-5 overflow-hidden rounded-md border border-[#E0E0E0] bg-white">

          <div className="border-b border-[#E0E0E0] px-5 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2874F0]">
              Customer feedback
            </p>

            <h2 className="mt-1 text-xl font-bold text-[#212121]">
              Customer Reviews
            </h2>
          </div>

          <div className="p-5">
            {reviewsError ? (
              <p
                role="status"
                className="text-sm text-[#878787]"
              >
                {reviewsError}
              </p>
            ) : reviewsLoading ? (
              <p className="text-sm text-[#878787]">
                Loading reviews...
              </p>
            ) : reviews.length === 0 ? (
              <div className="rounded-md border border-dashed border-[#D0D0D0] bg-[#FAFAFA] px-6 py-10 text-center">
                <Star
                  size={25}
                  className="mx-auto text-[#2874F0]"
                />

                <h3 className="mt-4 text-base font-bold text-[#212121]">
                  No reviews yet
                </h3>

                <p className="mt-2 text-sm text-[#878787]">
                  Be the first customer to review this
                  product.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#F0F0F0]">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="py-5 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                      <div>
                        <p className="text-sm font-bold text-[#212121]">
                          {review.user?.first_name ||
                            review.user_name ||
                            `${siteName} customer`}
                        </p>

                        {review.verified_purchase && (
                          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#388E3C]">
                            <Check size={12} />
                            Verified purchase
                          </p>
                        )}
                      </div>

                      <div className="inline-flex w-fit items-center gap-1 rounded-md bg-[#388E3C] px-2 py-1 text-xs font-bold !text-white">
                        {review.rating}

                        <Star
                          size={11}
                          fill="currentColor"
                        />
                      </div>
                    </div>

                    {review.comment && (
                      <p className="mt-3 text-sm leading-6 text-[#555]">
                        {review.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {reviewsTotalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2 border-t border-[#F0F0F0] pt-5">
                <button
                  type="button"
                  disabled={reviewsPage === 1}
                  onClick={() => {
                    setReviewsLoading(true);
                    setReviewsPage((page) => page - 1);
                  }}
                  className="cursor-pointer rounded-md border border-[#D0D0D0] px-4 py-2 text-sm font-semibold text-[#212121] transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="px-3 text-sm font-semibold text-[#555]">
                  {reviewsPage} / {reviewsTotalPages}
                </span>

                <button
                  type="button"
                  disabled={reviewsPage === reviewsTotalPages}
                  onClick={() => {
                    setReviewsLoading(true);
                    setReviewsPage((page) => page + 1);
                  }}
                  className="cursor-pointer rounded-md border border-[#D0D0D0] px-4 py-2 text-sm font-semibold text-[#212121] transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </section>

        {/* SUGGESTED PRODUCTS */}
        {suggestedProducts.length > 0 && (
          <section className="mt-5 overflow-hidden rounded-md border border-[#E0E0E0] bg-white">

            <div className="flex flex-col gap-3 border-b border-[#E0E0E0] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2874F0]">
                  You may also like
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#212121]">
                  Suggested Products
                </h2>
              </div>

              <Link
                to="/shop"
                className="inline-flex cursor-pointer items-center gap-1 text-sm font-bold text-[#2874F0] hover:text-[#1f65d6]"
              >
                View all
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {suggestedProducts.map((item) => (
                  <ProductCard
                    key={item.id}
                    product={item}
                    imageUrl={suggestedImages[item.id]}
                    compact
                  />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ProductDetails() {
  const { id } = useParams();

  return <ProductDetailsContent key={id} id={id} />;
}

export default ProductDetails;