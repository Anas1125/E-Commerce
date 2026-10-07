import {
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  Heart,
  ShoppingBag,
  Trash2,
  ArrowRight,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import useAuth from "../context/useAuth";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

import {
  EmptyState,
  LoadingState,
  Price,
} from "../components/Storefront";

function Wishlist() {
  const { siteName = "TerraLens" } = useContext(
    SiteBrandingContext,
  );

  const { isAuthenticated, refreshCounts } = useAuth();

  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [wishlistResponse, productResponse] =
        await Promise.all([
          api.get("/wishlist/"),
          api.get("/products/"),
        ]);

      setItems(wishlistResponse.data.items || []);

      setProducts(
        Object.fromEntries(
          (productResponse.data || []).map(
            (product) => [product.id, product],
          ),
        ),
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Unable to load your wishlist.",
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const timer = setTimeout(load, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [load]);

  const remove = async (productId) => {
    try {
      await api.delete(`/wishlist/${productId}`);

      setItems((current) =>
        current.filter(
          (item) =>
            item.product_id !== productId,
        ),
      );

      await refreshCounts();

      setError("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Unable to remove this item.",
      );
    }
  };

  const addToCart = async (productId) => {
    const product = products[productId];

    const availableStock = Number(
      product?.available_stock ??
        product?.stock ??
        0,
    );

    if (availableStock <= 0) {
      setError("This product is currently out of stock.");
      return;
    }

    try {
      await api.post("/cart/items", {
        product_id: productId,
        quantity: 1,
      });

      await refreshCounts();

      setError("Added to your cart.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Unable to add this item to cart.",
      );
    }
  };

  const openProduct = (productId) => {
    navigate(`/products/${productId}`);
  };

  const handleCardKeyDown = (event, productId) => {
    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openProduct(productId);
    }
  };

  return (
    <main className="min-h-screen bg-[#F1F3F6]">
      <SEO
        title="Wishlist"
        description={`View and manage your saved products on ${siteName}.`}
        noIndex
      />

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        <section className="rounded-lg bg-white px-5 py-6 sm:px-7">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-start gap-4">

              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2874F0]">
                <Heart
                  size={22}
                  fill="currentColor"
                />
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2874F0]">
                  Saved for later
                </p>

                <h1 className="mt-1 text-2xl font-bold text-[#212121] sm:text-3xl">
                  My Wishlist
                </h1>

                <p className="mt-1 text-sm text-[#878787]">
                  Keep track of products you want to
                  come back to.
                </p>
              </div>

            </div>

            {!loading &&
              isAuthenticated &&
              items.length > 0 && (
                <div className="flex items-center gap-3">

                  <Link
                    to="/checkout"
                    className="inline-flex items-center gap-2 rounded-md bg-[#2874F0] px-5 py-3 text-sm font-semibold !text-white transition hover:bg-[#1f65d6]"
                  >
                    Continue to Checkout
                    <ArrowRight size={17} />
                  </Link>

                  <div className="rounded-md border border-[#E0E0E0] bg-white px-6 py-3 text-center">
                    <p className="text-xl font-bold text-[#212121]">
                      {items.length}
                    </p>

                    <p className="text-xs text-[#878787]">
                      saved items
                    </p>
                  </div>

                </div>
              )}

          </div>

        </section>

        <section className="mt-5">

          {loading ? (

            <div className="rounded-lg bg-white px-6 py-12">
              <LoadingState label="Loading your wishlist..." />
            </div>

          ) : !isAuthenticated ? (

            <div className="rounded-lg bg-white px-6 py-16 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2874F0]">
                <Heart size={24} />
              </div>

              <h2 className="mt-5 text-xl font-bold text-[#212121]">
                Sign in to see your wishlist
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#878787]">
                Save your favourite products and come
                back to them whenever you want.
              </p>

              <Link
                to="/login"
                className="mt-6 inline-flex items-center rounded-md bg-[#2874F0] px-6 py-3 text-sm font-semibold !text-white transition hover:bg-[#1F65D6]"
              >
                Sign in
              </Link>

            </div>

          ) : error && items.length === 0 ? (

            <div className="rounded-lg bg-white px-6 py-12">
              <EmptyState
                title="Wishlist unavailable"
                text={error}
              />
            </div>

          ) : items.length === 0 ? (

            <div className="rounded-lg bg-white px-6 py-16 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2874F0]">
                <Heart size={24} />
              </div>

              <h2 className="mt-5 text-xl font-bold text-[#212121]">
                Your wishlist is empty
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#878787]">
                Tap the heart on any product to save it
                here for later.
              </p>

              <Link
                to="/shop"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#2874F0] px-6 py-3 text-sm font-semibold !text-white transition hover:bg-[#1F65D6]"
              >
                Explore the shop
                <ShoppingBag size={16} />
              </Link>

            </div>

          ) : (

            <>

              {/* Status message */}

              {error && (
                <div
                  role="status"
                  className="mb-4 rounded-md border border-[#E0E0E0] bg-white px-4 py-3 text-sm text-[#5F6368]"
                >
                  {error}
                </div>
              )}

              {/* Wishlist grid */}

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

                {items.map((item) => {

                  const product =
                    products[item.product_id];

                  const brand =
                    product?.brand ||
                    siteName;

                  const availableStock =
                    Number(
                      product?.available_stock ??
                        product?.stock ??
                        0,
                    );

                  const outOfStock =
                    availableStock <= 0;

                  return (

                    <article
                      key={item.product_id}
                      role="link"
                      tabIndex={0}
                      onClick={() =>
                        openProduct(
                          item.product_id,
                        )
                      }
                      onKeyDown={(event) =>
                        handleCardKeyDown(
                          event,
                          item.product_id,
                        )
                      }
                      className="group cursor-pointer overflow-hidden rounded-lg border border-[#E0E0E0] bg-white transition duration-200 hover:-translate-y-0.5 hover:border-[#C5D6EA] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#2874F0] focus:ring-offset-1"
                    >

                      {/* Image */}

                      <div className="relative block aspect-[4/3] overflow-hidden bg-[#F5F6F7]">

                        {item.image_url ? (

                          <img
                            src={item.image_url}
                            alt={item.product_name}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          />

                        ) : (

                          <div className="flex h-full w-full items-center justify-center text-[#2874F0]">
                            <ShoppingBag size={32} />
                          </div>

                        )}

                        {/* Wishlist button */}

                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            remove(
                              item.product_id,
                            );
                          }}
                          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-[#E0E0E0] bg-white text-[#2874F0] shadow-sm transition hover:bg-[#F1F3F6] cursor-pointer"
                          aria-label={`Remove ${item.product_name} from wishlist`}
                        >
                          <Heart
                            size={17}
                            fill="currentColor"
                          />
                        </button>

                      </div>

                      {/* Details */}

                      <div className="p-4">

                        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[#878787]">
                          {brand}
                        </p>

                        <div className="mt-1 min-h-[40px] text-sm font-semibold leading-5 text-[#212121]">
                          {item.product_name}
                        </div>

                        <div className="mt-3">
                          <Price
                            value={item.price}
                            className="text-base font-bold text-[#212121]"
                          />
                        </div>

                        {/* Actions */}

                        <div className="mt-4 flex gap-2">

                          <button
                            type="button"
                            disabled={outOfStock}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();

                              if (!outOfStock) {
                                addToCart(
                                  item.product_id,
                                );
                              }
                            }}
                            className={`inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-semibold whitespace-nowrap transition ${
                              outOfStock
                                ? "cursor-not-allowed bg-[#E0E0E0] text-[#878787]"
                                : "cursor-pointer bg-[#2874F0] !text-white hover:bg-[#1F65D6]"
                            }`}
                          >

                            <ShoppingBag
                              size={14}
                              className="shrink-0"
                            />

                            <span className="whitespace-nowrap">
                              {outOfStock
                                ? "Out of stock"
                                : "Add to cart"}
                            </span>

                          </button>

                          <button
                            type="button"
                            aria-label={`Remove ${item.product_name} from wishlist`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              remove(
                                item.product_id,
                              );
                            }}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#E0E0E0] bg-white text-[#878787] transition hover:border-[#E0E0E0] hover:bg-[#FFF5F5] hover:text-[#D32F2F] cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </button>

                        </div>

                      </div>

                    </article>

                  );
                })}

              </div>

              {/* Bottom shop link */}

              <div className="mt-6 flex flex-col gap-4 rounded-lg bg-white px-5 py-5 ring-1 ring-[#E0E0E0] sm:flex-row sm:items-center sm:justify-between sm:px-6">

                <div>
                  <h2 className="text-sm font-semibold text-[#212121]">
                    Looking for more?
                  </h2>

                  <p className="mt-1 text-xs text-[#878787]">
                    Discover more products and add them
                    to your wishlist.
                  </p>
                </div>

                <Link
                  to="/shop"
                  className="inline-flex w-fit items-center gap-2 rounded-md border border-[#2874F0] px-5 py-2.5 text-sm font-semibold !text-[#2874F0] transition hover:bg-[#EAF2FF]"
                >
                  Continue shopping
                  <ArrowRightIcon />
                </Link>

              </div>

            </>

          )}

        </section>

      </div>

    </main>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export default Wishlist;