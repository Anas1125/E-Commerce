import { useContext, useEffect, useState } from "react";
import { ArrowRight, Heart, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import SEO from "../components/SEO";
import { EmptyState, LoadingState, Price } from "../components/Storefront";
import { SiteBrandingContext } from "../context/site-branding-context";
import useAuth from "../context/useAuth";
import { setWishlistSaved } from "../context/useWishlist";
import api from "../services/api";

const NOTICE_DURATION_MS = 5000;

function getErrorMessage(requestError, fallback) {
  const detail = requestError?.response?.data?.detail;

  return typeof detail === "string" && detail ? detail : fallback;
}

function getBrandName(product) {
  if (!product) return "";

  if (typeof product.brand === "string") return product.brand;

  return product.brand?.name ?? product.brand_name ?? "";
}

function getAvailableStock(product) {
  if (!product) return null;

  const value = product.available_stock ?? product.stock;

  if (value == null) return null;

  const stock = Number(value);

  return Number.isFinite(stock) ? stock : null;
}


function Wishlist() {
  const { siteName = "TerraLens" } = useContext(SiteBrandingContext);

  const { isAuthenticated, refreshCounts } = useAuth();

  const [items, setItems] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [notice, setNotice] = useState(null);

  const [pending, setPending] = useState({});


  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let alive = true;

    async function load() {
      let wishlistResponse;

      try {
        wishlistResponse = await api.get("/wishlist/");
      } catch (requestError) {
        if (!alive) return;

        setError(getErrorMessage(requestError, "Unable to load your wishlist."));
        setLoading(false);
        return;
      }

      if (!alive) return;

      const wishlistItems = wishlistResponse.data?.items || [];

      let productMap = {};

      if (wishlistItems.some((item) => item.available_stock === undefined)) {
        try {
          const productResponse = await api.get("/products/");

          if (!alive) return;

          productMap = Object.fromEntries(
            (productResponse.data || []).map((product) => [product.id, product]),
          );
        } catch {
          // Brand and stock are optional extras.
        }
      }

      setItems(wishlistItems);
      setProducts(productMap);
      setError("");
      setLoading(false);
    }

    load();

    return () => {
      alive = false;

      setItems([]);
      setLoading(true);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!notice) return undefined;

    const timer = window.setTimeout(() => setNotice(null), NOTICE_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);


  const setBusy = (productId, busy) => {
    setPending((current) => {
      const next = { ...current };

      if (busy) {
        next[productId] = true;
      } else {
        delete next[productId];
      }

      return next;
    });
  };

  const refreshHeaderCounts = async () => {
    try {
      await refreshCounts();
    } catch {
      // The action itself succeeded; a stale header badge is not an error.
    }
  };

  const remove = async (productId) => {
    if (pending[productId]) return;

    setBusy(productId, true);

    try {
      await api.delete(`/wishlist/${productId}`);

      setItems((current) => current.filter((item) => item.product_id !== productId));
      // Keep the hearts on product cards in sync.
      setWishlistSaved(productId, false);
      setNotice(null);
    } catch (requestError) {
      setNotice({
        type: "error",
        text: getErrorMessage(requestError, "Unable to remove this item."),
      });
    } finally {
      setBusy(productId, false);
    }

    refreshHeaderCounts();
  };

  const addToCart = async (item) => {
    const productId = item.product_id;

    if (pending[productId]) return;

    const stock = getAvailableStock(products[productId] ?? item);

    if (stock !== null && stock <= 0) {
      setNotice({ type: "error", text: "This product is currently out of stock." });
      return;
    }

    setBusy(productId, true);

    try {
      await api.post("/cart/items", { product_id: productId, quantity: 1 });

      setNotice({ type: "success", text: "Added to your cart." });
      refreshHeaderCounts();
    } catch (requestError) {
      setNotice({
        type: "error",
        text: getErrorMessage(requestError, "Unable to add this item to cart."),
      });
    } finally {
      setBusy(productId, false);
    }
  };


  const itemCountLabel = items.length === 1 ? "saved item" : "saved items";

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
                <Heart size={22} fill="currentColor" />
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2874F0]">
                  Saved for later
                </p>

                <h1 className="mt-1 text-2xl font-bold text-[#212121] sm:text-3xl">
                  My Wishlist
                </h1>

                <p className="mt-1 text-sm text-[#878787]">
                  Keep track of products you want to come back to.
                </p>
              </div>
            </div>

            {isAuthenticated && !loading && items.length > 0 && (
              <div className="flex items-center gap-3">
                <Link
                  to="/cart"
                  className="inline-flex items-center gap-2 rounded-md bg-[#2874F0] px-5 py-3 text-sm font-semibold !text-white transition hover:bg-[#1f65d6]"
                >
                  View cart
                  <ArrowRight size={17} />
                </Link>

                <div className="rounded-md border border-[#E0E0E0] bg-white px-6 py-3 text-center">
                  <p className="text-xl font-bold text-[#212121]">{items.length}</p>

                  <p className="text-xs text-[#878787]">{itemCountLabel}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-5">
          {!isAuthenticated ? (
            <div className="rounded-lg bg-white px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2874F0]">
                <Heart size={24} />
              </div>

              <h2 className="mt-5 text-xl font-bold text-[#212121]">
                Sign in to see your wishlist
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#878787]">
                Save your favourite products and come back to them whenever you want.
              </p>

              <Link
                to="/login"
                className="mt-6 inline-flex items-center rounded-md bg-[#2874F0] px-6 py-3 text-sm font-semibold !text-white transition hover:bg-[#1F65D6]"
              >
                Sign in
              </Link>
            </div>
          ) : loading ? (
            <div className="rounded-lg bg-white px-6 py-12">
              <LoadingState label="Loading your wishlist..." />
            </div>
          ) : error ? (
            <div className="rounded-lg bg-white px-6 py-12">
              <EmptyState title="Wishlist unavailable" text={error} />
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
                Tap the heart on any product to save it here for later.
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
              {/* Action feedback */}
              {notice && (
                <div
                  role={notice.type === "error" ? "alert" : "status"}
                  className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-white px-4 py-3 text-sm ${
                    notice.type === "error"
                      ? "border-[#F5C6C6] text-[#B3261E]"
                      : "border-[#E0E0E0] text-[#5F6368]"
                  }`}
                >
                  <span>{notice.text}</span>

                  {notice.type === "success" && (
                    <Link
                      to="/cart"
                      className="font-semibold text-[#2874F0] hover:underline"
                    >
                      View cart
                    </Link>
                  )}
                </div>
              )}

              {/* Wishlist grid */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {items.map((item) => {
                  const productId = item.product_id;
                  const product = products[productId];

                  const brand = getBrandName(product) || item.brand || "";
                  const stock = getAvailableStock(product ?? item);
                  const outOfStock = stock !== null && stock <= 0;
                  const busy = Boolean(pending[productId]);

                  return (
                    <article
                      key={productId}
                      className="group relative overflow-hidden rounded-lg border border-[#E0E0E0] bg-white transition duration-200 hover:-translate-y-0.5 hover:border-[#C5D6EA] hover:shadow-md"
                    >
                      {/* Image */}
                      <div className="relative aspect-[4/3] overflow-hidden bg-[#F5F6F7]">
                        <Link
                          to={`/products/${productId}`}
                          tabIndex={-1}
                          aria-hidden="true"
                          className="block h-full w-full"
                        >
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt=""
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[#2874F0]">
                              <ShoppingBag size={32} />
                            </div>
                          )}
                        </Link>

                        {/* Wishlist heart */}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => remove(productId)}
                          className="absolute right-3 top-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[#E0E0E0] bg-white text-[#2874F0] shadow-sm transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`Remove ${item.product_name} from wishlist`}
                        >
                          <Heart size={17} fill="currentColor" />
                        </button>
                      </div>

                      {/* Details */}
                      <div className="p-4">
                        {brand && (
                          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[#878787]">
                            {brand}
                          </p>
                        )}

                        <Link
                          to={`/products/${productId}`}
                          className="mt-1 block min-h-[40px] text-sm font-semibold leading-5 text-[#212121] hover:text-[#2874F0] focus:outline-none focus-visible:underline"
                        >
                          {item.product_name}
                        </Link>

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
                            disabled={outOfStock || busy}
                            onClick={() => addToCart(item)}
                            className={`inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-semibold whitespace-nowrap transition ${
                              outOfStock
                                ? "cursor-not-allowed bg-[#E0E0E0] text-[#878787]"
                                : "cursor-pointer bg-[#2874F0] !text-white hover:bg-[#1F65D6] disabled:cursor-wait disabled:opacity-70"
                            }`}
                          >
                            <ShoppingBag size={14} className="shrink-0" />

                            <span>{outOfStock ? "Out of stock" : "Add to cart"}</span>
                          </button>

                          <button
                            type="button"
                            disabled={busy}
                            aria-label={`Remove ${item.product_name} from wishlist`}
                            onClick={() => remove(productId)}
                            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[#E0E0E0] bg-white text-[#878787] transition hover:bg-[#FFF5F5] hover:text-[#D32F2F] disabled:cursor-not-allowed disabled:opacity-60"
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
                  <h2 className="text-sm font-semibold text-[#212121]">Looking for more?</h2>

                  <p className="mt-1 text-xs text-[#878787]">
                    Discover more products and add them to your wishlist.
                  </p>
                </div>

                <Link
                  to="/shop"
                  className="inline-flex w-fit items-center gap-2 rounded-md border border-[#2874F0] px-5 py-2.5 text-sm font-semibold !text-[#2874F0] transition hover:bg-[#EAF2FF]"
                >
                  Continue shopping
                  <ArrowRight size={15} />
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export default Wishlist;