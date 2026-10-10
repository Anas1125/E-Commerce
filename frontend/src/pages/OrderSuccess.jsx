import { useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  Check,
  Clock3,
  Package,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  XCircle,
} from "lucide-react";

import api from "../services/api";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";
import { LoadingState, Price } from "../components/Storefront";


const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2874F0] focus-visible:ring-offset-2";

const TONES = {
  success: {
    Icon: Check,
    iconWrap: "bg-[#E8F5E9] text-[#388E3C]",
    eyebrow: "text-[#388E3C]",
    status: "text-[#388E3C]",
  },
  warning: {
    Icon: Clock3,
    iconWrap: "bg-[#FFF3CD] text-[#8A5A00]",
    eyebrow: "text-[#8A5A00]",
    status: "text-[#8A5A00]",
  },
  error: {
    Icon: XCircle,
    iconWrap: "bg-[#FFF1F1] text-[#C62828]",
    eyebrow: "text-[#C62828]",
    status: "text-[#C62828]",
  },
  neutral: {
    Icon: Package,
    iconWrap: "bg-[#E8F0FE] text-[#2874F0]",
    eyebrow: "text-[#2874F0]",
    status: "text-[#212121]",
  },
};

const PAYMENT_METHOD_LABELS = {
  cod: "Cash on Delivery",
  upi: "UPI",
  card: "Card",
  netbanking: "Net banking",
  wallet: "Wallet",
  online: "Online payment",
  razorpay: "Online payment",
};

const PAYMENT_STATUS_LABELS = {
  paid: "Paid",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
};

const formatStatus = (value) =>
  String(value || "")
    .replaceAll("_", " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getPaymentMethodLabel = (method) => {
  const key = String(method || "").toLowerCase();

  return PAYMENT_METHOD_LABELS[key] || formatStatus(method) || "Not available";
};

const getPaymentStatusLabel = (order) => {
  const status = String(order?.payment_status || "").toLowerCase();
  const isCod = String(order?.payment_method || "").toLowerCase() === "cod";

  if (isCod && (status === "pending" || !status)) return "Pay on delivery";

  return PAYMENT_STATUS_LABELS[status] || formatStatus(status) || "Not available";
};

// Decide what the page should say based on the real order state.
const getVariant = (order) => {
  if (!order) {
    return {
      tone: "neutral",
      eyebrow: "Order status",
      title: "Order details",
      text: "Order details aren't available in this view.",
    };
  }

  const orderStatus = String(order.order_status || "").toLowerCase();
  const paymentStatus = String(order.payment_status || "").toLowerCase();
  const isCod = String(order.payment_method || "").toLowerCase() === "cod";

  if (orderStatus === "cancelled") {
    return {
      tone: "error",
      eyebrow: "Order cancelled",
      title: "This order was cancelled",
      text: "No further action is needed for this order.",
    };
  }

  if (paymentStatus === "failed") {
    return {
      tone: "error",
      eyebrow: "Payment failed",
      title: "Your payment didn't go through",
      text: "Your order hasn't been confirmed. Open the order for details.",
    };
  }

  if (isCod) {
    return {
      tone: "success",
      eyebrow: "Cash on Delivery",
      title: "Your order is confirmed!",
      text: "We've received your order. Payment is due when your order is delivered.",
    };
  }

  if (paymentStatus === "paid") {
    return {
      tone: "success",
      eyebrow: "Payment received",
      title: "Your order is confirmed!",
      text: "Thank you for your purchase. We'll keep you updated on its progress.",
    };
  }

  if (paymentStatus === "pending") {
    return {
      tone: "warning",
      eyebrow: "Payment pending",
      title: "We're confirming your payment",
      text: "This can take a few minutes. Check your order for the latest status.",
    };
  }

  return {
    tone: "neutral",
    eyebrow: "Order status",
    title: "Order details",
    text: "Here is the latest information we have for this order.",
  };
};


function OrderSuccess() {
  const { state } = useLocation();
  const { id: paramId } = useParams();

  const branding = useContext(SiteBrandingContext) || {};
  const { siteName = "TerraLens" } = branding;

  const stateOrder = state?.order || null;

  // Ignore router state that belongs to a different order than the URL.
  const initialOrder =
    stateOrder && (!paramId || String(stateOrder.id) === String(paramId))
      ? stateOrder
      : null;

  const [order, setOrder] = useState(initialOrder);
  const [fetching, setFetching] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const orderId = paramId ?? stateOrder?.id ?? null;

  const headingRef = useRef(null);

  // Show the state order instantly, then confirm with the server.
  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    const loadOrder = async () => {
      setFetching(true);

      try {
        const response = await api.get(`/orders/${orderId}`);

        if (cancelled) return;

        if (response?.data && typeof response.data === "object") {
          setOrder(response.data);
          setFetchFailed(false);
        }
      } catch {
        if (!cancelled) setFetchFailed(true);
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    loadOrder();

    return () => {
      cancelled = true;
    };
  }, [orderId, reloadKey]);

  const retry = () => {
    setFetchFailed(false);
    setReloadKey((key) => key + 1);
  };

  const hasOrder = Boolean(order);

  // Move focus to the heading so screen readers announce the result.
  useEffect(() => {
    if (!fetching || hasOrder) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [hasOrder, fetching]);

  const seo = (
    <SEO
      title="Order Confirmation"
      description={`View your ${siteName} order confirmation and payment details.`}
      noIndex
    />
  );

  // Nothing to show yet and a request is in flight.
  if (!order && fetching) {
    return (
      <>
        {seo}

        <div className="min-h-screen bg-[#F1F3F6] px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <LoadingState />
          </div>
        </div>
      </>
    );
  }

  const variant = getVariant(order);
  const tone = TONES[variant.tone];
  const HeaderIcon = tone.Icon;

  const isCod = String(order?.payment_method || "").toLowerCase() === "cod";
  const isCancelled = String(order?.order_status || "").toLowerCase() === "cancelled";
  const paymentStatus = String(order?.payment_status || "").toLowerCase();
  const showCodNotice = isCod && !isCancelled && paymentStatus !== "paid";

  const items = Array.isArray(order?.items) ? order.items : [];

  return (
    <>
      {seo}

      <div className="min-h-screen bg-[#F1F3F6] px-4 py-12 sm:px-6">
        <div className="mx-auto flex min-h-[75vh] max-w-4xl items-center justify-center">
          <div className="w-full overflow-hidden rounded-md border border-[#E0E0E0] bg-white shadow-sm">
            {/* HEADER */}
            <div
              role="status"
              className="border-b border-[#E0E0E0] px-6 py-10 text-center sm:px-10"
            >
              <div
                className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${tone.iconWrap}`}
              >
                <HeaderIcon size={30} strokeWidth={2.5} aria-hidden="true" />
              </div>

              <p
                className={`mt-6 text-xs font-bold uppercase tracking-[0.2em] ${tone.eyebrow}`}
              >
                {variant.eyebrow}
              </p>

              <h1
                ref={headingRef}
                tabIndex={-1}
                className="mt-2 text-3xl font-bold tracking-tight text-[#212121] outline-none"
              >
                {variant.title}
              </h1>

              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#878787]">
                {variant.text}
              </p>
            </div>

            {order ? (
              <>
                <div className="px-6 py-6 sm:px-10">
                  {fetchFailed && (
                    <div className="mb-5 flex flex-col gap-2 rounded-md border border-[#F2D49A] bg-[#FFF9EC] px-4 py-3 text-sm text-[#8A5A00] sm:flex-row sm:items-center sm:justify-between">
                      <p>
                        We couldn’t refresh this order. The details below may be
                        out of date.
                      </p>

                      <button
                        type="button"
                        onClick={retry}
                        disabled={fetching}
                        className={`inline-flex cursor-pointer items-center gap-1.5 self-start rounded-md px-3 py-1.5 text-sm font-semibold underline disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto ${FOCUS_RING}`}
                      >
                        <RotateCcw size={14} aria-hidden="true" />
                        {fetching ? "Refreshing..." : "Refresh"}
                      </button>
                    </div>
                  )}

                  {/* ORDER INFO */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="min-w-0 rounded-md bg-[#F7F8FA] p-4">
                      <div className="flex items-center gap-2">
                        <Package
                          size={17}
                          className="text-[#2874F0]"
                          aria-hidden="true"
                        />

                        <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                          Order number
                        </p>
                      </div>

                      <p className="mt-2 break-all text-sm font-bold text-[#212121]">
                        {order.order_number || "Not available"}
                      </p>
                    </div>

                    <div className="rounded-md bg-[#F7F8FA] p-4">
                      <div className="flex items-center gap-2">
                        <ShoppingBag
                          size={17}
                          className="text-[#2874F0]"
                          aria-hidden="true"
                        />

                        <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                          Total
                        </p>
                      </div>

                      <Price
                        value={order.total_amount}
                        className="mt-2 text-sm font-bold text-[#212121]"
                      />
                    </div>

                    <div className="rounded-md bg-[#F7F8FA] p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                        Order status
                      </p>

                      <p
                        className={`mt-2 text-sm font-bold capitalize ${tone.status}`}
                      >
                        {formatStatus(order.order_status) || "Not available"}
                      </p>
                    </div>
                  </div>

                  {/* ITEMS */}
                  {items.length > 0 && (
                    <div className="mt-5 rounded-md border border-[#E0E0E0]">
                      <div className="border-b border-[#E0E0E0] px-5 py-4">
                        <h2 className="font-bold text-[#212121]">
                          Items ({items.length})
                        </h2>
                      </div>

                      <ul className="divide-y divide-[#F0F0F0] px-5">
                        {items.map((item, index) => (
                          <li
                            key={item.id ?? index}
                            className="flex items-center justify-between gap-4 py-3 text-sm"
                          >
                            <span className="min-w-0 truncate font-semibold text-[#212121]">
                              {item.product_name || "Product"}
                            </span>

                            {item.quantity ? (
                              <span className="shrink-0 text-xs text-[#878787]">
                                Qty {item.quantity}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* PAYMENT DETAILS */}
                  <div className="mt-5 rounded-md border border-[#E0E0E0]">
                    <div className="border-b border-[#E0E0E0] px-5 py-4">
                      <h2 className="font-bold text-[#212121]">
                        Payment Details
                      </h2>
                    </div>

                    <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                          Payment method
                        </p>

                        <p className="mt-2 text-sm font-semibold text-[#212121]">
                          {getPaymentMethodLabel(order.payment_method)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                          Payment status
                        </p>

                        <p className="mt-2 text-sm font-semibold text-[#212121]">
                          {getPaymentStatusLabel(order)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* COD NOTICE */}
                  {showCodNotice && (
                    <div className="mt-5 rounded-md border border-[#C8E6C9] bg-[#F1F8F2] p-4">
                      <div className="flex gap-3">
                        <ShieldCheck
                          size={20}
                          className="mt-0.5 shrink-0 text-[#388E3C]"
                          aria-hidden="true"
                        />

                        <div>
                          <p className="text-sm font-bold text-[#2E7D32]">
                            Amount due on delivery
                          </p>

                          <Price
                            value={order.total_amount}
                            className="mt-1 text-sm font-bold text-[#212121]"
                          />

                          <p className="mt-1 text-xs leading-5 text-[#555]">
                            Please keep the order total ready when your delivery
                            arrives.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ACTIONS */}
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <Link
                      to={`/orders/${order.id}`}
                      className={`inline-flex cursor-pointer items-center justify-center rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6] ${FOCUS_RING}`}
                    >
                      View order
                    </Link>

                    <Link
                      to="/shop"
                      className={`inline-flex cursor-pointer items-center justify-center rounded-md border border-[#D0D0D0] bg-white px-7 py-3 text-sm font-bold text-[#212121] transition hover:border-[#2874F0] hover:bg-[#F5F9FF] hover:text-[#2874F0] ${FOCUS_RING}`}
                    >
                      Continue shopping
                    </Link>
                  </div>
                </div>

                {/* FOOTER */}
                {variant.tone === "success" && (
                  <div className="border-t border-[#E0E0E0] bg-[#FAFAFA] px-6 py-4 text-center sm:px-10">
                    <div className="flex items-center justify-center gap-2 text-xs text-[#878787]">
                      <ShieldCheck size={15} aria-hidden="true" />
                      Your order has been securely recorded.
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* NO ORDER STATE */
              <div className="px-6 py-10 text-center sm:px-10">
                <p className="text-sm leading-6 text-[#878787]">
                  {fetchFailed
                    ? "We couldn’t load this order right now. "
                    : "Order details aren't available in this view. "}
                  Visit{" "}
                  <Link
                    to="/orders"
                    className={`rounded-sm font-semibold text-[#2874F0] hover:underline ${FOCUS_RING}`}
                  >
                    your orders
                  </Link>{" "}
                  to find your recent purchases.
                </p>

                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  {fetchFailed && orderId && (
                    <button
                      type="button"
                      onClick={retry}
                      disabled={fetching}
                      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[#D0D0D0] bg-white px-7 py-3 text-sm font-bold text-[#212121] transition hover:border-[#2874F0] hover:text-[#2874F0] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      {fetching ? "Trying again..." : "Try again"}
                    </button>
                  )}

                  <Link
                    to="/shop"
                    className={`inline-flex cursor-pointer items-center justify-center rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6] ${FOCUS_RING}`}
                  >
                    Continue shopping
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default OrderSuccess;