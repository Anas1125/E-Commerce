import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  Star,
} from "lucide-react";

import api from "../services/api";
import ProductCard from "../components/ProductCard";
import useAuth from "../context/useAuth";
import { LoadingState, Price } from "../components/Storefront";

function ProductDetails() {
  const { id } = useParams();

  const { isAuthenticated } = useAuth();
  const [product, setProduct] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [saved, setSaved] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [reviews, setReviews] = useState([]);
  const [suggestedProducts, setSuggestedProducts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await api.get(`/products/${id}`);
        setProduct(response.data);
        try { const images = await api.get(`/products/${id}/images`); setImageUrl(images.data.find((image) => image.is_primary)?.image_url || images.data[0]?.image_url || null); } catch { setImageUrl(null); }
      } catch (error) {
        console.error("Failed to load product:", error);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (!product) {
      return;
    }

    const fetchReviews = async () => {
      try {
        const response = await api.get(
          `/products/${product.id}/reviews`
        );

        setReviews(response.data);
      } catch (error) {
        console.error("Failed to load reviews:", error);
        setReviews([]);
        setReviewsError("Reviews are temporarily unavailable.");
      }
    };

    const fetchSuggestedProducts = async () => {
      try {
        const response = await api.get("/products/");

        const otherProducts = response.data.filter(
          (item) => item.id !== product.id
        );

        const scoredProducts = otherProducts.map((item) => {
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

          return {
            ...item,
            recommendationScore: score,
          };
        });

        scoredProducts.sort(
          (a, b) =>
            b.recommendationScore - a.recommendationScore
        );

        setSuggestedProducts(
          scoredProducts.slice(0, 4)
        );
      } catch (error) {
        console.error(
          "Failed to load suggested products:",
          error
        );

        setSuggestedProducts([]);
      }
    };

    const loadProductExtras = async () => {
      setReviewsLoading(true);

      await Promise.all([
        fetchReviews(),
        fetchSuggestedProducts(),
      ]);

      setReviewsLoading(false);
    };

    loadProductExtras();
  }, [product]);

  if (loading) return <div className="mx-auto max-w-7xl px-6 py-16"><LoadingState label="Loading product…" /></div>;

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold">
          Product not found
        </h1>

        <Link
          to="/shop"
          className="mt-5 inline-block text-sm font-medium text-[#486B57]"
        >
          ← Back to Shop
        </Link>
      </div>
    );
  }

  const outOfStock = product.stock <= 0;

  const decreaseQuantity = () => {
    setQuantity((current) => Math.max(1, current - 1));
  };

  const increaseQuantity = () => {
    setQuantity((current) =>
      Math.min(product.stock, current + 1)
    );
  };

  const handleWishlist = async () => {
    if (!isAuthenticated) { setMessage("Please sign in to save this product."); return; }
    try { if (saved) { await api.delete(`/wishlist/${product.id}`); setSaved(false); setMessage("Removed from wishlist."); } else { await api.post(`/wishlist/${product.id}`); setSaved(true); setMessage("Saved to wishlist."); } } catch (error) { setMessage(error.response?.data?.detail || "Unable to update wishlist."); }
  };

  const handleAddToCart = async () => {
    setAdding(true);
    setMessage("");

    try {
      await api.post("/cart/items", {
        product_id: product.id,
        quantity,
      });

      setMessage("Added to cart successfully.");
    } catch (error) {
      console.error("Failed to add product to cart:", error);

      const detail = error.response?.data?.detail;

      if (
        error.response?.status === 401 ||
        detail === "Not authenticated"
      ) {
        setMessage(
          "Please log in to add this product to your cart."
        );
      } else {
        setMessage(
          detail || "Unable to add this product to your cart."
        );
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Breadcrumb */}
      <div className="mb-7 text-xs text-[#737A74]">
        <Link
          to="/"
          className="hover:text-[#486B57]"
        >
          Home
        </Link>

        <span className="mx-2">/</span>

        <Link
          to="/shop"
          className="hover:text-[#486B57]"
        >
          Shop
        </Link>

        <span className="mx-2">/</span>

        <span>{product.name}</span>
      </div>

      {/* Product */}
      <section className="grid gap-10 lg:grid-cols-2">
        {/* Image */}
        <div className="relative">
          <button type="button" onClick={handleWishlist} aria-label={saved ? "Remove from wishlist" : "Add to wishlist"} className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm transition hover:bg-[#DCE7DE]">
            <Heart size={18} fill={saved ? "currentColor" : "none"} />
          </button>

          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-[#E3E5DF] bg-[#F5F5F1]">
            {imageUrl ? <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" /> : <span className="text-sm text-[#737A74]">Image coming soon</span>}
          </div>
        </div>

        {/* Information */}
        <div className="flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#486B57]">
            {product.brand || "TerraLens"}
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            {product.name}
          </h1>

          {/* Rating */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Star
                size={16}
                fill="currentColor"
                className="text-[#486B57]"
              />

              <span className="text-sm font-medium">
                {Number(product.rating || 0).toFixed(1)}
              </span>
            </div>

            <span className="text-sm text-[#737A74]">
              ({reviews.length} reviews)
            </span>
          </div>

          {/* Price */}
          <Price value={product.price} className="mt-5 block text-2xl font-bold" />

          {/* Description */}
          <div className="mt-6 border-t border-[#E3E5DF] pt-6">
            <h2 className="text-base font-semibold">
              Description
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-[#737A74]">
              {product.description ||
                "No description available."}
            </p>
          </div>

          {/* Stock */}
          <div className="mt-5">
            {outOfStock ? (
              <p className="text-sm font-medium text-red-600">
                Out of stock
              </p>
            ) : (
              <p className="text-sm font-medium text-[#486B57]">
                {product.stock} available
              </p>
            )}
          </div>

          {/* Quantity */}
          {!outOfStock && (
            <div className="mt-5 flex items-center gap-4">
              <span className="text-sm font-medium">
                Quantity
              </span>

              <div className="flex items-center overflow-hidden rounded-lg border border-[#E3E5DF] bg-white">
                <button
                  type="button"
                  onClick={decreaseQuantity}
                  className="flex h-10 w-10 items-center justify-center transition hover:bg-[#F5F5F1]"
                >
                  <Minus size={15} />
                </button>

                <span className="flex h-10 w-11 items-center justify-center border-x border-[#E3E5DF] text-sm font-medium">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={increaseQuantity}
                  className="flex h-10 w-10 items-center justify-center transition hover:bg-[#F5F5F1]"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Add to cart */}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={outOfStock || adding}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#486B57] px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShoppingBag size={18} />

            {adding
              ? "Adding..."
              : outOfStock
                ? "Out of Stock"
                : `Add ${quantity} to Cart`}
          </button>

          {/* Cart message */}
          {message && (
            <p
              className={`mt-3 text-center text-xs ${
                message.includes("successfully")
                  ? "text-[#486B57]"
                  : "text-[#737A74]"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </section>

      {/* Reviews */}
      <section className="mt-20 border-t border-[#E3E5DF] pt-12">
        <div className="mb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#486B57]">
            Customer feedback
          </p>

          <h2 className="mt-2 text-2xl font-bold">
            Customer Reviews
          </h2>
        </div>

        {reviewsError ? <p role="status" className="text-sm text-[#737A74]">{reviewsError}</p> : reviewsLoading ? (
          <p className="text-sm text-[#737A74]">
            Loading reviews...
          </p>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-[#E3E5DF] bg-white px-6 py-10 text-center">
            <h3 className="text-base font-semibold">
              No reviews yet
            </h3>

            <p className="mt-2 text-sm text-[#737A74]">
              Be the first customer to review this product.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-2xl border border-[#E3E5DF] bg-white p-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">
                      {review.user?.first_name || review.user_name || "TerraLens customer"}
                    </p>

                    {review.verified_purchase && (
                      <p className="mt-1 text-xs text-[#486B57]">
                        Verified purchase
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <Star
                      size={14}
                      fill="currentColor"
                      className="text-[#486B57]"
                    />

                    <span className="text-sm font-medium">
                      {review.rating}
                    </span>
                  </div>
                </div>

                {review.comment && (
                  <p className="mt-4 text-sm leading-6 text-[#737A74]">
                    {review.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Suggested Products */}
      {suggestedProducts.length > 0 && (
        <section className="mt-20 border-t border-[#E3E5DF] pt-12">
          <div className="mb-7 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#486B57]">
                You may also like
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Suggested Products
              </h2>
            </div>

            <Link
              to="/shop"
              className="text-sm font-medium text-[#486B57]"
            >
              View all →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {suggestedProducts.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default ProductDetails;