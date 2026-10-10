import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  LifeBuoy,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
  Truck,
  XCircle,
} from "lucide-react";

import api from "../services/api";
import useAuth from "../context/useAuth";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";
import { EmptyState, LoadingState, Price } from "../components/Storefront";

const NETWORK_ERROR = "Network problem. Check your connection and try again.";
const SUPPORT_PATH = "/contact";
const STICKY_TOP = "lg:top-24";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2874F0] focus-visible:ring-offset-2";

const ORDER_STATUS_STYLES = {
  pending: {
    Icon: Clock3,
    icon: "bg-[#FFF3CD] text-[#8A5A00]",
    badge: "bg-[#FFF3CD] text-[#8A5A00]",
    dot: "bg-[#B26A00]",
  },
  confirmed: {
    Icon: Package,
    icon: "bg-[#E8F0FE] text-[#2874F0]",
    badge: "bg-[#E8F0FE] text-[#2874F0]",
    dot: "bg-[#2874F0]",
  },
  processing: {
    Icon: Package,
    icon: "bg-[#E8F0FE] text-[#2874F0]",
    badge: "bg-[#E8F0FE] text-[#2874F0]",
    dot: "bg-[#2874F0]",
  },
  shipped: {
    Icon: Truck,
    icon: "bg-[#E8F0FE] text-[#2874F0]",
    badge: "bg-[#E8F0FE] text-[#2874F0]",
    dot: "bg-[#2874F0]",
  },
  out_for_delivery: {
    Icon: Truck,
    icon: "bg-[#E8F0FE] text-[#2874F0]",
    badge: "bg-[#E8F0FE] text-[#2874F0]",
    dot: "bg-[#2874F0]",
  },
  delivered: {
    Icon: CheckCircle2,
    icon: "bg-[#E8F5E9] text-[#388E3C]",
    badge: "bg-[#E8F5E9] text-[#388E3C]",
    dot: "bg-[#388E3C]",
  },
  cancelled: {
    Icon: XCircle,
    icon: "bg-[#FFF1F1] text-[#C62828]",
    badge: "bg-[#FFF1F1] text-[#C62828]",
    dot: "bg-[#C62828]",
  },
};

const DEFAULT_STATUS_STYLE = {
  Icon: Clock3,
  icon: "bg-[#F0F0F0] text-[#555]",
  badge: "bg-[#F0F0F0] text-[#555]",
  dot: "bg-[#878787]",
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

const getErrorMessage = (error, fallback) => {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;

  if (status === 404 || status === 403) {
    return "We couldn’t find this order in your account.";
  }

  if (status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.msg) return String(item.msg).replace(/^Value error,\s*/i, "");
        return "";
      })
      .filter(Boolean);

    if (messages.length) return messages.join(" ");
  }

  if (typeof detail === "string" && detail.trim()) return detail;

  if (error?.response) return fallback;
  if (error?.request) return NETWORK_ERROR;

  return fallback;
};

const formatStatus = (value) =>
  String(value || "").replaceAll("_", " ").trim();

const formatDateTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString("en-IN");
};

const getStatusStyle = (status) =>
  ORDER_STATUS_STYLES[String(status || "").toLowerCase()] ||
  DEFAULT_STATUS_STYLE;

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

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
};

const getAddress = (order) => {
  const raw =
    order?.shipping_address || order?.delivery_address || order?.address || null;

  if (!raw || typeof raw !== "object") return null;

  const name = raw.full_name || raw.name || "";
  const lines = [
    raw.line1 || raw.address_line1 || raw.address_line_1 || raw.street || "",
    raw.line2 || raw.address_line2 || raw.address_line_2 || "",
    raw.landmark || "",
  ].filter(Boolean);

  const cityLine = [
    raw.city,
    raw.state,
    raw.pincode || raw.postal_code || raw.zip_code,
  ]
    .filter(Boolean)
    .join(", ");

  const phone = raw.phone_number || raw.phone || "";

  if (!name && lines.length === 0 && !cityLine && !phone) return null;

  return { name, lines, cityLine, phone };
};

function OrderDetails({ id }) {
  const { isAuthenticated } = useAuth();

  const branding = useContext(SiteBrandingContext) || {};
  const { siteName = "TerraLens" } = branding;

  const [order, setOrder] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [refund, setRefund] = useState(null);
  const [refundsLoaded, setRefundsLoaded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const headingRef = useRef(null);
  const cancellingRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const load = async () => {
      // The order is required; history and refunds are optional extras.
      const [orderResult, historyResult, refundsResult] =
        await Promise.allSettled([
          api.get(`/orders/${id}`),
          api.get(`/orders/${id}/history`),
          api.get("/refunds/my"),
        ]);

      if (cancelled) return;

      if (orderResult.status === "rejected") {
        setError(
          getErrorMessage(orderResult.reason, "Unable to load this order."),
        );
        setLoading(false);
        return;
      }

      const orderData = orderResult.value?.data;

      if (!orderData || typeof orderData !== "object") {
        setError("This order could not be found.");
        setLoading(false);
        return;
      }

      setOrder(orderData);

      if (historyResult.status === "fulfilled") {
        const data = historyResult.value?.data;
        setHistory(Array.isArray(data) ? data : []);
        setHistoryFailed(false);
      } else {
        setHistoryFailed(true);
      }

      if (refundsResult.status === "fulfilled") {
        const data = Array.isArray(refundsResult.value?.data)
          ? refundsResult.value.data
          : [];

        const forThisOrder = data
          .filter((item) => String(item.order_id) === String(orderData.id))
          .sort(
            (a, b) =>
              new Date(b.created_at || 0) - new Date(a.created_at || 0),
          );

        setRefund(forThisOrder[0] || null);
        setRefundsLoaded(true);
      } else {
        setRefundsLoaded(false);
      }

      setError("");
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, reloadKey]);

  const retryLoad = () => {
    setLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    if (order) headingRef.current?.focus({ preventScroll: true });
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps


  const cancelOrder = async () => {
    if (!order || cancellingRef.current) return;

    cancellingRef.current = true;
    setCancelling(true);
    setCancelError("");

    try {
      const response = await api.post(`/orders/${order.id}/cancel`);

      if (!mountedRef.current) return;
      setOrder((current) => ({
        ...current,
        ...(response.data || {}),
        items: response.data?.items ?? current?.items,
      }));

      setConfirmingCancel(false);

      setReloadKey((key) => key + 1);
    } catch (requestError) {
      if (!mountedRef.current) return;

      setCancelError(
        getErrorMessage(requestError, "Unable to cancel this order."),
      );
    } finally {
      cancellingRef.current = false;

      if (mountedRef.current) setCancelling(false);
    }
  };

  const timeline = useMemo(
    () =>
      [...history].sort((a, b) => {
        const first = Date.parse(a?.changed_at);
        const second = Date.parse(b?.changed_at);

        if (Number.isNaN(first) || Number.isNaN(second)) return 0;

        return first - second;
      }),
    [history],
  );

  const seoTitle = order?.order_number
    ? `Order ${order.order_number}`
    : "Order Details";

  const seo = (
    <SEO
      title={seoTitle}
      description={`View your ${siteName} order details, payment status, and delivery progress.`}
      noIndex
    />
  );

  if (!isAuthenticated) {
    return (
      <>
        {seo}

        <div className="min-h-screen bg-[#F1F3F6] px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <EmptyState
              title="Sign in to view this order"
              text="Order details are available from your account."
              action="Sign in"
              to="/login"
            />
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        {seo}

        <div className="min-h-screen bg-[#F1F3F6] px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <LoadingState />
          </div>
        </div>
      </>
    );
  }

  if (error || !order) {
    return (
      <>
        {seo}

        <div className="min-h-screen bg-[#F1F3F6] px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-md border border-[#E0E0E0] bg-white px-6 py-12 text-center">
            <h1 className="text-xl font-bold text-[#212121]">
              Order unavailable
            </h1>

            <p role="alert" className="mt-2 text-sm text-[#878787]">
              {error || "This order could not be found."}
            </p>

            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={retryLoad}
                className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[#D0D0D0] bg-white px-6 py-2.5 text-sm font-bold text-[#212121] transition hover:border-[#2874F0] hover:text-[#2874F0] ${FOCUS_RING}`}
              >
                <RotateCcw size={15} aria-hidden="true" />
                Try again
              </button>

              <Link
                to="/orders"
                className={`inline-flex cursor-pointer items-center justify-center rounded-md bg-[#2874F0] px-6 py-2.5 text-sm font-bold !text-white transition hover:bg-[#1f65d6] ${FOCUS_RING}`}
              >
                Back to orders
              </Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const orderStatusKey = String(order.order_status || "").toLowerCase();
  const statusText = formatStatus(order.order_status) || "Status unavailable";
  const statusStyle = getStatusStyle(orderStatusKey);
  const StatusIcon = statusStyle.Icon;

  const items = Array.isArray(order.items) ? order.items : [];
  const address = getAddress(order);

  const isCod = String(order.payment_method || "").toLowerCase() === "cod";
  const paymentStatus = String(order.payment_status || "").toLowerCase();
  const isPaid = paymentStatus === "paid";
  const isCancelled = orderStatusKey === "cancelled";
  const isDelivered = orderStatusKey === "delivered";

  const discount = toNumber(order.discount_amount);
  const shipping = toNumber(order.shipping_fee);

  const canCancel = !isCancelled && !isDelivered && !isPaid;
  const canRequestRefund = isDelivered && isPaid && refundsLoaded && !refund;
  const codDue = isCod && !isPaid && !isCancelled;

  return (
    <>
      {seo}

      <div className="min-h-screen bg-[#F1F3F6] pb-16">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* TOP */}
          <div className="mb-6">
            <Link
              to="/orders"
              className={`inline-flex cursor-pointer items-center gap-2 rounded-md text-sm font-semibold text-[#2874F0] hover:text-[#1f65d6] ${FOCUS_RING}`}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Back to orders
            </Link>

            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2874F0]">
                  Order details
                </p>

                <h1
                  ref={headingRef}
                  tabIndex={-1}
                  className="mt-1 break-all text-3xl font-bold tracking-tight text-[#212121] outline-none"
                >
                  {order.order_number || "Order"}
                </h1>

                <p className="mt-1 text-sm text-[#878787]">
                  Placed {formatDateTime(order.created_at)}
                </p>
              </div>

              <span
                className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-bold capitalize ${statusStyle.badge}`}
              >
                <StatusIcon size={16} aria-hidden="true" />
                {statusText}
              </span>
            </div>
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
            {/* LEFT */}
            <div className="min-w-0 space-y-5">
              {/* ITEMS */}
              <section
                aria-labelledby="order-items-heading"
                className="rounded-md border border-[#E0E0E0] bg-white"
              >
                <div className="border-b border-[#E0E0E0] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F7FA] text-[#2874F0]">
                      <Package size={18} aria-hidden="true" />
                    </div>

                    <div>
                      <h2
                        id="order-items-heading"
                        className="font-bold text-[#212121]"
                      >
                        Items
                      </h2>

                      <p className="text-xs text-[#878787]">
                        Products included in this order
                      </p>
                    </div>
                  </div>
                </div>

                {items.length > 0 ? (
                  <div className="divide-y divide-[#F0F0F0]">
                    {items.map((item, index) => (
                      <div
                        key={item.id ?? index}
                        className="flex justify-between gap-5 px-5 py-5"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-sm font-bold text-[#212121]">
                            {item.product_name || "Product"}
                          </p>

                          <p className="mt-1 text-xs text-[#878787]">
                            Quantity {item.quantity ?? 1} · Unit{" "}
                            <Price value={item.unit_price} />
                          </p>

                          {toNumber(item.discount_amount) > 0 && (
                            <p className="mt-2 text-xs font-semibold text-[#388E3C]">
                              Item discount{" "}
                              <Price value={item.discount_amount} />
                            </p>
                          )}
                        </div>

                        <Price
                          value={item.final_price}
                          className="shrink-0 text-sm font-bold text-[#212121]"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-5 py-6 text-sm text-[#878787]">
                    Item details aren’t available for this order.
                  </p>
                )}
              </section>

              {/* ORDER PROGRESS */}
              <section
                aria-labelledby="order-progress-heading"
                className="rounded-md border border-[#E0E0E0] bg-white"
              >
                <div className="border-b border-[#E0E0E0] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F7FA] text-[#2874F0]">
                      <Truck size={18} aria-hidden="true" />
                    </div>

                    <div>
                      <h2
                        id="order-progress-heading"
                        className="font-bold text-[#212121]"
                      >
                        Order Progress
                      </h2>

                      <p className="text-xs text-[#878787]">
                        Updates for this order
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  {historyFailed && (
                    <div className="mb-5 flex flex-col gap-2 rounded-md border border-[#F2D49A] bg-[#FFF9EC] px-4 py-3 text-sm text-[#8A5A00] sm:flex-row sm:items-center sm:justify-between">
                      <p>Order updates couldn’t be loaded right now.</p>

                      <button
                        type="button"
                        onClick={() => setReloadKey((key) => key + 1)}
                        className={`cursor-pointer self-start rounded-md px-3 py-1.5 text-sm font-semibold underline sm:self-auto ${FOCUS_RING}`}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {timeline.length > 0 ? (
                    <ol aria-label="Order status updates">
                      {timeline.map((entry, index) => {
                        const isLatest = index === timeline.length - 1;
                        const entryStyle = getStatusStyle(entry.status);

                        return (
                          <li
                            key={entry.id ?? index}
                            aria-current={isLatest ? "step" : undefined}
                            className="relative flex gap-4 pb-6 last:pb-0"
                          >
                            {!isLatest && (
                              <span
                                aria-hidden="true"
                                className="absolute bottom-0 left-[7px] top-5 w-px bg-[#E0E0E0]"
                              />
                            )}

                            <span
                              aria-hidden="true"
                              className={`relative z-10 mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                                isLatest ? entryStyle.dot : "bg-[#D0D0D0]"
                              }`}
                            >
                              {isLatest && (
                                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                              )}
                            </span>

                            <div className="min-w-0">
                              <p
                                className={`text-sm font-bold capitalize ${
                                  isLatest ? "text-[#212121]" : "text-[#555]"
                                }`}
                              >
                                {formatStatus(entry.status) || "Update"}
                              </p>

                              <p className="mt-1 text-xs text-[#878787]">
                                {formatDateTime(entry.changed_at)}
                              </p>

                              {entry.note && (
                                <p className="mt-2 break-words text-sm leading-5 text-[#666]">
                                  {entry.note}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    !historyFailed && (
                      <p className="text-sm text-[#878787]">
                        No status updates yet.
                      </p>
                    )
                  )}
                </div>
              </section>
            </div>

            {/* RIGHT */}
            <aside className={`min-w-0 space-y-5 lg:sticky ${STICKY_TOP}`}>
              {/* PAYMENT */}
              <section
                aria-labelledby="order-payment-heading"
                className="rounded-md border border-[#E0E0E0] bg-white"
              >
                <div className="border-b border-[#E0E0E0] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <CreditCard
                      size={19}
                      className="text-[#2874F0]"
                      aria-hidden="true"
                    />

                    <h2
                      id="order-payment-heading"
                      className="font-bold text-[#212121]"
                    >
                      Payment
                    </h2>
                  </div>
                </div>

                <div className="space-y-3 p-5 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-[#878787]">Method</span>

                    <span className="text-right font-semibold text-[#212121]">
                      {getPaymentMethodLabel(order.payment_method)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-[#878787]">Status</span>

                    <span className="text-right font-semibold text-[#212121]">
                      {getPaymentStatusLabel(order)}
                    </span>
                  </div>

                  {codDue && (
                    <div className="flex justify-between gap-4 rounded-md bg-[#F1F8F2] px-3 py-2">
                      <span className="font-semibold text-[#2E7D32]">
                        Due on delivery
                      </span>

                      <Price
                        value={order.total_amount}
                        className="font-bold text-[#212121]"
                      />
                    </div>
                  )}

                  {refund && (
                    <div className="flex justify-between gap-4">
                      <span className="text-[#878787]">Refund</span>

                      <span className="text-right font-semibold capitalize text-[#212121]">
                        {formatStatus(refund.status) || "Requested"}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {address && (
                <section
                  aria-labelledby="order-address-heading"
                  className="rounded-md border border-[#E0E0E0] bg-white"
                >
                  <div className="border-b border-[#E0E0E0] px-5 py-4">
                    <h2
                      id="order-address-heading"
                      className="font-bold text-[#212121]"
                    >
                      Delivery Address
                    </h2>
                  </div>

                  <div className="p-5">
                    <div className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
                        <MapPin size={17} aria-hidden="true" />
                      </div>

                      <address className="min-w-0 break-words text-sm not-italic leading-6 text-[#555]">
                        {address.name && (
                          <p className="font-semibold text-[#212121]">
                            {address.name}
                          </p>
                        )}

                        {address.lines.map((line) => (
                          <p key={line}>{line}</p>
                        ))}

                        {address.cityLine && <p>{address.cityLine}</p>}

                        {address.phone && (
                          <p className="mt-1">Phone: {address.phone}</p>
                        )}
                      </address>
                    </div>
                  </div>
                </section>
              )}

              {/* PRICE DETAILS */}
              <section
                aria-labelledby="order-price-heading"
                className="overflow-hidden rounded-md border border-[#E0E0E0] bg-white"
              >
                <div className="border-b border-[#E0E0E0] px-5 py-4">
                  <h2
                    id="order-price-heading"
                    className="font-bold text-[#212121]"
                  >
                    Price Details
                  </h2>
                </div>

                <div className="p-5">
                  <div className="space-y-4 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#555]">Subtotal</span>

                      <Price value={toNumber(order.subtotal)} />
                    </div>

                    {discount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-[#555]">Discount</span>

                        <span className="font-semibold text-[#388E3C]">
                          - <Price value={discount} />
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-[#555]">Shipping</span>

                      {shipping > 0 ? (
                        <Price value={shipping} />
                      ) : (
                        <span className="font-semibold text-[#388E3C]">
                          Free
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="my-5 border-t border-dashed border-[#D0D0D0]" />

                  <div className="flex items-center justify-between">
                    <span className="text-base font-bold text-[#212121]">
                      Total
                    </span>

                    <Price
                      value={toNumber(order.total_amount)}
                      className="text-xl font-bold text-[#212121]"
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#878787]">
                    <ShieldCheck size={15} aria-hidden="true" />
                    Secure order information
                  </div>
                </div>
              </section>

              {/* ACTIONS / HELP */}
              <section
                aria-labelledby="order-help-heading"
                className="rounded-md border border-[#E0E0E0] bg-white p-5"
              >
                <h2
                  id="order-help-heading"
                  className="font-bold text-[#212121]"
                >
                  Need help?
                </h2>

                <div className="mt-4 space-y-3">
                  {canRequestRefund && (
                    <Link
                      to="/orders"
                      className={`flex cursor-pointer items-center gap-2 rounded-md text-sm font-semibold text-[#C62828] hover:underline ${FOCUS_RING}`}
                    >
                      <RotateCcw size={15} aria-hidden="true" />
                      Request a refund from My Orders
                    </Link>
                  )}

                  {canCancel && !confirmingCancel && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelError("");
                        setConfirmingCancel(true);
                      }}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded-md text-left text-sm font-semibold text-[#C62828] hover:underline ${FOCUS_RING}`}
                    >
                      <XCircle size={15} aria-hidden="true" />
                      Cancel order
                    </button>
                  )}

                  {canCancel && confirmingCancel && (
                    <div className="rounded-md border border-[#F1B8B8] bg-[#FFF5F5] p-4">
                      <p className="text-sm font-semibold text-[#212121]">
                        Cancel this order?
                      </p>

                      <p className="mt-1 text-xs leading-5 text-[#878787]">
                        This can’t be undone.
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmingCancel(false)}
                          disabled={cancelling}
                          className={`cursor-pointer rounded-md border border-[#D0D0D0] bg-white px-4 py-2 text-sm font-semibold text-[#555] hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                        >
                          Keep order
                        </button>

                        <button
                          type="button"
                          onClick={cancelOrder}
                          disabled={cancelling}
                          className={`cursor-pointer rounded-md bg-[#C62828] px-4 py-2 text-sm font-bold text-white hover:bg-[#AD2020] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                        >
                          {cancelling ? "Cancelling..." : "Yes, cancel"}
                        </button>
                      </div>
                    </div>
                  )}

                  {cancelError && (
                    <p
                      role="alert"
                      className="rounded-md bg-[#FFF1F0] px-3 py-2 text-sm font-medium text-[#D32F2F]"
                    >
                      {cancelError}
                    </p>
                  )}

                  <Link
                    to={`${SUPPORT_PATH}?order=${encodeURIComponent(
                      order.order_number || order.id
                    )}`}
                    className={`flex cursor-pointer items-center gap-2 rounded-md text-sm font-semibold text-[#2874F0] hover:underline ${FOCUS_RING}`}
                  >
                    <LifeBuoy size={15} aria-hidden="true" />
                    Contact support about this order
                  </Link>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}

function OrderDetailsPage() {
  const { id } = useParams();

  return <OrderDetails key={id} id={id} />;
}

export default OrderDetailsPage;