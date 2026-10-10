import {
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import api from "../services/api";
import useAuth from "../context/useAuth";
import { LoadingState, Price } from "../components/Storefront";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

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

const getMaxQuantity = (product, item) => {
  if (!product) {
    return null;
  }

  if (product.available_stock != null) {
    const available = Number(product.available_stock);

    if (Number.isFinite(available)) {
      return Math.max(0, available + item.quantity);
    }
  }

  const stock = Number(product.stock);

  return Number.isFinite(stock) ? stock : null;
};

function Cart() {
  const { siteName = "TerraLens" } =
    useContext(SiteBrandingContext) || {};

  const {
    isAuthenticated,
    loading: authLoading,
    refreshCounts,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const [cart, setCart] = useState(null);
  const [products, setProducts] = useState({});
  const [images, setImages] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const requestedImagesRef = useRef(new Set());

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadAll = async () => {
      try {
        const [cartResponse, productsResponse] =
          await Promise.all([
            api.get("/cart/"),
            api.get("/products/"),
          ]);

        if (cancelled) {
          return;
        }

        setCart(cartResponse.data);

        setProducts(
          Object.fromEntries(
            productsResponse.data.map((product) => [
              product.id,
              product,
            ]),
          ),
        );

        setError("");
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        setError(
          getErrorMessage(
            requestError,
            "Unable to load your cart.",
          ),
        );
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };

    loadAll();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, reloadKey]);

  const cartProductIds = cart?.items
    ?.map((item) => item.product_id)
    .join(",");

  useEffect(() => {
    if (!cartProductIds) {
      return;
    }

    const idsToLoad = cartProductIds
      .split(",")
      .filter((id) => !requestedImagesRef.current.has(id));

    idsToLoad.forEach((id) => {
      requestedImagesRef.current.add(id);

      const loadImage = async () => {
        try {
          const response = await api.get(
            `/products/${id}/images`,
          );

          const url = pickPrimaryImage(response.data);

          if (url) {
            setImages((current) => ({
              ...current,
              [id]: url,
            }));
          }
        } catch {
          // No image: the placeholder icon is shown instead.
        }
      };

      loadImage();
    });
  }, [cartProductIds]);

  const reloadCart = async () => {
    const response = await api.get("/cart/");

    setCart(response.data);
  };

  const refreshProduct = async (productId) => {
    try {
      const response = await api.get(`/products/${productId}`);

      setProducts((current) => ({
        ...current,
        [productId]: response.data,
      }));
    } catch {
      // Keep the previous product data if this fails.
    }
  };

  const runCartAction = async (item, action, fallback) => {
    if (updatingId !== null) {
      return;
    }

    setUpdatingId(item.id);
    setError("");

    try {
      await action();
      await reloadCart();
      await refreshProduct(item.product_id);
      await refreshCounts();
    } catch (requestError) {
      setError(getErrorMessage(requestError, fallback));
    } finally {
      setUpdatingId(null);
    }
  };

  const changeQuantity = (item, quantity) =>
    runCartAction(
      item,
      () =>
        api.put(`/cart/items/${item.id}`, {
          quantity,
        }),
      "Cart update failed.",
    );

  const removeItem = (item) =>
    runCartAction(
      item,
      () => api.delete(`/cart/items/${item.id}`),
      "Unable to remove item.",
    );
  const loading = authLoading || (isAuthenticated && !loaded);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-10 sm:px-6">
        <SEO
          title="Cart"
          description={`View your shopping cart at ${siteName}.`}
          noIndex
        />
        <div className="mx-auto max-w-7xl">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-10 sm:px-6">
        <SEO
          title="Cart"
          description={`View your shopping cart at ${siteName}.`}
          noIndex
        />
        <div className="mx-auto max-w-4xl">
          <div className="border border-[#E0E0E0] bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
              <ShoppingBag size={27} />
            </div>

            <h1 className="mt-5 text-2xl font-bold text-[#212121]">
              Sign in to view your cart
            </h1>

            <p className="mx-auto mt-2 max-w-md text-sm text-[#878787]">
              Your cart is connected to your {siteName} account.
              Sign in to continue shopping.
            </p>

            <Link
              to="/login"
              state={{ from: location }}
              className="mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
            >
              Sign in
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error && !cart) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-10 sm:px-6">
        <SEO
          title="Cart"
          description={`View your shopping cart at ${siteName}.`}
          noIndex
        />
        <div className="mx-auto max-w-7xl">
          <div
            role="alert"
            className="border border-[#FFCDD2] bg-[#FFEBEE] px-5 py-4 text-sm text-[#D32F2F]"
          >
            {error}
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setLoaded(false);
              setReloadKey((key) => key + 1);
            }}
            className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-6 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!cart?.items?.length) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-10 sm:px-6">
        <SEO
          title="Cart"
          description={`View your shopping cart at ${siteName}.`}
          noIndex
        />
        <div className="mx-auto max-w-7xl">

          {/* PAGE HEADER */}
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2874F0]">
              Shopping Cart
            </p>

            <h1 className="mt-2 text-2xl font-bold text-[#212121] sm:text-3xl">
              Your Cart
            </h1>
          </div>

          {/* ERROR (for example after removing the last item fails) */}
          {error && (
            <div
              role="alert"
              className="mb-5 border border-[#FFCDD2] bg-[#FFEBEE] px-5 py-4 text-sm text-[#D32F2F]"
            >
              {error}
            </div>
          )}

          {/* EMPTY CART */}
          <div className="border border-[#E0E0E0] bg-white px-6 py-16 text-center sm:py-20">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F1F3F6] text-[#2874F0]">
              <ShoppingBag size={32} />
            </div>

            <h2 className="mt-6 text-xl font-bold text-[#212121]">
              Your cart is empty
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm text-[#878787]">
              Looks like you haven't added anything to your
              cart yet. Explore our products and find something
              you like.
            </p>

            <Link
              to="/shop"
              className="mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
            >
              Continue Shopping
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const itemCount = cart.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );

  const busy = updatingId !== null;
  const hasUnavailableItem = cart.items.some((item) => {
    const product = products[item.product_id];
    const maxQuantity = getMaxQuantity(product, item);

    if (!product) {
      return false;
    }

    return (
      product.is_active === false ||
      (maxQuantity !== null &&
        (maxQuantity <= 0 || item.quantity > maxQuantity))
    );
  });

  return (
    <div className="min-h-screen bg-[#F1F3F6] px-4 py-6 pb-14 sm:px-6 sm:py-8">
      <SEO
        title="Cart"
        description={`View and manage the products in your ${siteName} shopping cart.`}
        noIndex
      />
      <div className="mx-auto max-w-7xl">

        {/* PAGE HEADER */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2874F0]">
              Shopping Cart
            </p>

            <h1 className="mt-1 text-2xl font-bold text-[#212121] sm:text-3xl">
              My Cart
            </h1>

            <p className="mt-1 text-sm text-[#878787]">
              {itemCount}{" "}
              {itemCount === 1 ? "item" : "items"} in your
              cart
            </p>
          </div>

          <Link
            to="/shop"
            className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-bold text-[#2874F0] hover:text-[#1f65d6]"
          >
            Continue Shopping
            <ArrowRight size={16} />
          </Link>
        </div>

        {/* ERROR */}
        {error && (
          <div
            role="alert"
            className="mb-5 border border-[#FFCDD2] bg-[#FFEBEE] px-5 py-4 text-sm text-[#D32F2F]"
          >
            {error}
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">

          {/* CART ITEMS */}
          <section className="border border-[#E0E0E0] bg-white">

            <div className="flex items-center justify-between border-b border-[#E0E0E0] px-5 py-4">
              <h2 className="text-base font-bold text-[#212121]">
                Cart Items
              </h2>

              <span className="text-xs text-[#878787]">
                {cart.items.length}{" "}
                {cart.items.length === 1
                  ? "product"
                  : "products"}
              </span>
            </div>

            <div>
              {cart.items.map((item, index) => {
                const product =
                  products[item.product_id] || {};

                const image = images[item.product_id];
                const stock = getMaxQuantity(
                  products[item.product_id],
                  item,
                );

                const isUpdating = updatingId === item.id;

                const unavailable =
                  Boolean(products[item.product_id]) &&
                  (product.is_active === false ||
                    (stock !== null &&
                      (stock <= 0 ||
                        item.quantity > stock)));

                const atStockLimit =
                  stock !== null &&
                  item.quantity >= stock;

                return (
                  <article
                    key={item.id}
                    aria-busy={isUpdating}
                    className={`p-5 transition-opacity ${
                      isUpdating ? "opacity-60" : ""
                    } ${
                      index !== cart.items.length - 1
                        ? "border-b border-[#E0E0E0]"
                        : ""
                    }`}
                  >
                    <div className="flex gap-4 sm:gap-5">

                      {/* IMAGE */}
                      <Link
                        to={`/products/${item.product_id}`}
                        className="group flex h-28 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden border border-[#E0E0E0] bg-white sm:h-36 sm:w-36"
                      >
                        {image ? (
                          <img
                            src={image}
                            alt={item.product_name}
                            className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <ShoppingBag
                            size={28}
                            className="text-[#BDBDBD]"
                          />
                        )}
                      </Link>

                      {/* DETAILS */}
                      <div className="min-w-0 flex-1">

                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">

                            <p className="text-xs font-bold uppercase tracking-wide text-[#2874F0]">
                              {product.brand || siteName}
                            </p>

                            <Link
                              to={`/products/${item.product_id}`}
                              className="mt-1 block cursor-pointer text-sm font-semibold leading-5 text-[#212121] hover:text-[#2874F0] sm:text-base"
                            >
                              {item.product_name}
                            </Link>

                            {product.description && (
                              <p className="mt-1 hidden max-w-xl text-xs leading-5 text-[#878787] sm:block">
                                {product.description}
                              </p>
                            )}
                          </div>

                          {/* PRICE */}
                          <div className="shrink-0 text-right">
                            {Number(item.discount_amount || 0) > 0 ? (
                              <>
                                <Price value={item.discounted_line_total} className="block text-base font-bold text-[#388E3C] sm:text-lg" />
                                <Price value={item.line_total} className="block text-xs text-[#878787] line-through" />
                              </>
                            ) : (
                              <Price value={item.line_total} className="text-base font-bold text-[#212121] sm:text-lg" />
                            )}
                          </div>
                        </div>

                        {/* STOCK / DELIVERY */}
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                          {unavailable ? (
                            <span className="font-semibold text-[#D32F2F]">
                              {stock !== null &&
                              stock > 0 &&
                              item.quantity > stock
                                ? `Only ${stock} available`
                                : "Out of stock"}
                            </span>
                          ) : stock !== null &&
                            stock > 0 &&
                            stock <= 5 ? (
                            <span className="font-semibold text-[#E65100]">
                              Only {stock} left
                            </span>
                          ) : stock !== null ? (
                            <span className="font-semibold text-[#388E3C]">
                              In stock
                            </span>
                          ) : null}

                          <span className="flex items-center gap-1 text-[#878787]">
                            <Truck size={13} />
                            Delivery calculated at checkout
                          </span>
                        </div>

                        {/* ACTIONS */}
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">

                          {/* QUANTITY */}
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-[#555]">
                              Quantity
                            </span>

                            <div className="flex h-9 items-center overflow-hidden border border-[#D0D0D0]">
                              <button
                                type="button"
                                aria-label="Decrease quantity"
                                disabled={
                                  busy ||
                                  item.quantity <= 1
                                }
                                onClick={() =>
                                  changeQuantity(
                                    item,
                                    item.quantity - 1,
                                  )
                                }
                                className="flex h-full w-9 cursor-pointer items-center justify-center text-[#212121] transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Minus size={14} />
                              </button>

                              <span className="flex h-full min-w-10 items-center justify-center border-x border-[#D0D0D0] px-2 text-sm font-semibold text-[#212121]">
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                aria-label="Increase quantity"
                                disabled={
                                  busy || atStockLimit
                                }
                                onClick={() =>
                                  changeQuantity(
                                    item,
                                    item.quantity + 1,
                                  )
                                }
                                className="flex h-full w-9 cursor-pointer items-center justify-center text-[#212121] transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>

                          {/* REMOVE */}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => removeItem(item)}
                            aria-label={`Remove ${item.product_name}`}
                            className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#555] transition hover:text-[#D32F2F] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={15} />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* PRICE DETAILS */}
          <aside className="border border-[#E0E0E0] bg-white lg:sticky lg:top-5">

            <div className="border-b border-[#E0E0E0] px-5 py-4">
              <h2 className="text-base font-bold uppercase tracking-wide text-[#878787]">
                Price Details
              </h2>
            </div>

            <div className="p-5">

              {/* SUBTOTAL */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#555]">
                  Price ({itemCount}{" "}
                  {itemCount === 1 ? "item" : "items"})
                </span>

                <Price
                  value={cart.subtotal}
                  className="font-semibold text-[#212121]"
                />
              </div>

              {/* DISCOUNT */}
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-[#555]">
                  Discount
                </span>

                <span className="font-semibold text-[#388E3C]">
                  - <Price value={cart.discount_total} />
                </span>
              </div>

              {/* SHIPPING */}
              <div className="mt-4 flex items-start justify-between gap-4 text-sm">
                <span className="text-[#555]">
                  Delivery Charges
                </span>

                <span className="text-right font-semibold text-[#878787]">
                  Calculated at checkout
                </span>
              </div>

              {/* TOTAL */}
              <div className="mt-5 border-t border-dashed border-[#D0D0D0] pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-[#212121]">
                    Total Amount
                  </span>

                  <Price
                    value={cart.discounted_subtotal}
                    className="text-xl font-bold text-[#212121]"
                  />
                </div>
              </div>

              {/* INFO */}
              <div className="mt-5 border-t border-[#E0E0E0] pt-5">
                <div className="flex gap-3">
                  <Truck
                    size={18}
                    className="mt-0.5 shrink-0 text-[#2874F0]"
                  />

                  <p className="text-xs leading-5 text-[#878787]">
                    Final discounts, delivery charges,
                    stock availability and total amount
                    will be confirmed during checkout.
                  </p>
                </div>
              </div>

              {/* UNAVAILABLE ITEMS */}
              {hasUnavailableItem && (
                <p
                  role="status"
                  className="mt-5 rounded-md bg-[#FFF3E0] px-4 py-3 text-xs leading-5 text-[#E65100]"
                >
                  Some items are unavailable. Remove them or
                  lower the quantity to continue.
                </p>
              )}

              {/* CHECKOUT */}
              <button
                type="button"
                disabled={busy || hasUnavailableItem}
                onClick={() => navigate("/checkout")}
                className="mt-6 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-5 text-sm font-bold !text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to Checkout
                <ArrowRight size={17} />
              </button>

            </div>
          </aside>
        </div>

        {/* TRUST STRIP */}
        <div className="mt-5 grid border border-[#E0E0E0] bg-white sm:grid-cols-3">

          <div className="flex items-center gap-3 border-b border-[#E0E0E0] px-5 py-4 sm:border-b-0 sm:border-r">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F5E9] text-[#388E3C]">
              <Truck size={17} />
            </div>

            <div>
              <p className="text-xs font-bold text-[#212121]">
                Reliable delivery
              </p>

              <p className="mt-0.5 text-[11px] text-[#878787]">
                Delivery details at checkout
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-[#E0E0E0] px-5 py-4 sm:border-b-0 sm:border-r">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
              <ShoppingBag size={17} />
            </div>

            <div>
              <p className="text-xs font-bold text-[#212121]">
                Secure shopping
              </p>

              <p className="mt-0.5 text-[11px] text-[#878787]">
                Your cart is linked to your account
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF8E1] text-[#F9A825]">
              <ArrowRight size={17} />
            </div>

            <div>
              <p className="text-xs font-bold text-[#212121]">
                Easy checkout
              </p>

              <p className="mt-0.5 text-[11px] text-[#878787]">
                Review everything before ordering
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default Cart;