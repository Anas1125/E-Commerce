import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Package,
  RotateCcw,
  ShoppingBag,
  Star,
  Truck,
  XCircle,
} from "lucide-react";

import api from "../services/api";
import useAuth from "../context/useAuth";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";
import { EmptyState, LoadingState, Price } from "../components/Storefront";

const REFUND_REASONS = [
  "Product damaged",
  "Wrong product received",
  "Product not as described",
  "Product missing parts",
  "Product stopped working",
  "Changed my mind",
  "Other",
];

const ORDERS_PER_PAGE = 5;

const NETWORK_ERROR = "Network problem. Check your connection and try again.";

const MAX_REFUND_REASON_LENGTH = 1000;
const MAX_REFUND_PROBLEM_LENGTH = 500;
const MAX_REFUND_FEEDBACK_LENGTH = 300;
const RETRY_REFUND_STATUSES = [];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2874F0] focus-visible:ring-offset-1";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const ORDER_STATUS_STYLES = {
  pending: {
    Icon: Clock3,
    icon: "bg-[#FFF3CD] text-[#8A5A00]",
    badge: "bg-[#FFF3CD] text-[#8A5A00]",
  },
  confirmed: {
    Icon: Package,
    icon: "bg-[#E8F0FE] text-[#2874F0]",
    badge: "bg-[#E8F0FE] text-[#2874F0]",
  },
  processing: {
    Icon: Package,
    icon: "bg-[#E8F0FE] text-[#2874F0]",
    badge: "bg-[#E8F0FE] text-[#2874F0]",
  },
  shipped: {
    Icon: Truck,
    icon: "bg-[#E8F0FE] text-[#2874F0]",
    badge: "bg-[#E8F0FE] text-[#2874F0]",
  },
  out_for_delivery: {
    Icon: Truck,
    icon: "bg-[#E8F0FE] text-[#2874F0]",
    badge: "bg-[#E8F0FE] text-[#2874F0]",
  },
  delivered: {
    Icon: CheckCircle2,
    icon: "bg-[#E8F5E9] text-[#388E3C]",
    badge: "bg-[#E8F5E9] text-[#388E3C]",
  },
  cancelled: {
    Icon: XCircle,
    icon: "bg-[#FFF1F1] text-[#C62828]",
    badge: "bg-[#FFF1F1] text-[#C62828]",
  },
};

const DEFAULT_ORDER_STATUS_STYLE = {
  Icon: Clock3,
  icon: "bg-[#F0F0F0] text-[#555]",
  badge: "bg-[#F0F0F0] text-[#555]",
};

const REFUND_STYLES = {
  completed: {
    wrapper: "border-[#B7DFC0] bg-[#F1FBF3]",
    icon: "text-[#2E7D32]",
    badge: "bg-[#E8F5E9] text-[#2E7D32]",
  },
  approved: {
    wrapper: "border-[#B8D4F5] bg-[#F2F7FD]",
    icon: "text-[#2874F0]",
    badge: "bg-[#E8F0FE] text-[#2874F0]",
  },
  requested: {
    wrapper: "border-[#F2D49A] bg-[#FFF9EC]",
    icon: "text-[#B26A00]",
    badge: "bg-[#FFF3CD] text-[#8A5A00]",
  },
};

const REFUND_NEGATIVE_STYLE = {
  wrapper: "border-[#F1B8B8] bg-[#FFF5F5]",
  icon: "text-[#C62828]",
  badge: "bg-[#FFF1F1] text-[#C62828]",
};

const REFUND_NEGATIVE_STATUSES = ["rejected", "declined", "failed", "cancelled"];

const getErrorMessage = (error, fallback) => {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;

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
  String(value || "").replaceAll("_", " ").trim() || "unknown";

const formatDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const getOrderStatusStyle = (status) =>
  ORDER_STATUS_STYLES[status] || DEFAULT_ORDER_STATUS_STYLE;

const getRefundStyle = (status) => {
  if (REFUND_NEGATIVE_STATUSES.includes(status)) return REFUND_NEGATIVE_STYLE;
  return REFUND_STYLES[status] || REFUND_STYLES.requested;
};

const getRefundLabel = (status) => {
  if (status === "requested") return "Refund requested";
  if (status === "approved") return "Refund approved";
  if (status === "completed") return "Refund completed";

  return `Refund ${formatStatus(status)}`;
};

function Modal({
  labelledBy,
  dismissible,
  onRequestClose,
  widthClass = "max-w-lg",
  children,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onRequestClose);
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    closeRef.current = onRequestClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const target = dialog?.querySelector("[data-autofocus]") || dialog;
    target?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (dismissibleRef.current) {
          event.stopPropagation();
          closeRef.current?.();
        }
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE));

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) {
          onRequestClose?.();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`max-h-[90vh] w-full ${widthClass} overflow-y-auto rounded-xl bg-white shadow-2xl outline-none`}
      >
        {children}
      </div>
    </div>
  );
}

function Orders() {
  const { isAuthenticated } = useAuth();

  const branding = useContext(SiteBrandingContext) || {};
  const { siteName = "TerraLens" } = branding;

  const [orders, setOrders] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [refundsFailed, setRefundsFailed] = useState(false);

  // Starts true so there is never a flash of "No orders yet" before fetch.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);

  // Review
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");
  const [reviewedProductIds, setReviewedProductIds] = useState([]);

  // Refund
  const [refundOrder, setRefundOrder] = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundProblem, setRefundProblem] = useState("");
  const [refundFeedback, setRefundFeedback] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [refundSuccess, setRefundSuccess] = useState("");

  // Cancel
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancellingOrderId, setCancellingOrderId] = useState(null);
  const [cancelError, setCancelError] = useState("");

  const mountedRef = useRef(false);
  const closeTimerRef = useRef(null);
  const reviewSubmittingRef = useRef(false);
  const refundSubmittingRef = useRef(false);
  const cancellingRef = useRef(false);
  const cancelErrorRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const fetchOrders = async () => {
      // Orders are required; refunds are optional and may fail independently.
      const [ordersResult, refundsResult] = await Promise.allSettled([
        api.get("/orders/"),
        api.get("/refunds/my"),
      ]);

      if (cancelled) return;

      if (ordersResult.status === "rejected") {
        setError(getErrorMessage(ordersResult.reason, "Unable to load orders."));
        setLoading(false);
        return;
      }

      const ordersData = ordersResult.value?.data;
      setOrders(Array.isArray(ordersData) ? ordersData : []);

      if (refundsResult.status === "fulfilled") {
        const refundsData = refundsResult.value?.data;
        setRefunds(Array.isArray(refundsData) ? refundsData : []);
        setRefundsFailed(false);
      } else {
        setRefunds([]);
        setRefundsFailed(true);
      }

      setCurrentPage(1);
      setError("");
      setLoading(false);
    };

    fetchOrders();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, reloadKey]);

  const retryLoad = () => {
    setLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    if (!cancelError || !cancelErrorRef.current) return;

    cancelErrorRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [cancelError]);

  const refundByOrder = useMemo(() => {
    const map = new Map();

    refunds.forEach((refund) => {
      const existing = map.get(refund.order_id);

      if (
        !existing ||
        new Date(refund.created_at || 0) >= new Date(existing.created_at || 0)
      ) {
        map.set(refund.order_id, refund);
      }
    });

    return map;
  }, [refunds]);

  const totalPages = Math.max(Math.ceil(orders.length / ORDERS_PER_PAGE), 1);

  const paginatedOrders = orders.slice(
    (currentPage - 1) * ORDERS_PER_PAGE,
    currentPage * ORDERS_PER_PAGE,
  );

  const goToPage = (page) => {
    setCurrentPage(Math.min(Math.max(page, 1), totalPages));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetReview = () => {
    setReviewItem(null);
    setReviewRating(0);
    setReviewTitle("");
    setReviewComment("");
    setReviewError("");
    setReviewSuccess("");
  };

  const openReviewModal = (item) => {
    clearTimeout(closeTimerRef.current);
    resetReview();
    setReviewItem(item);
  };

  const closeReviewModal = () => {
    if (reviewSubmittingRef.current) return;

    clearTimeout(closeTimerRef.current);
    resetReview();
  };

  const submitReview = async () => {
    if (!reviewItem || reviewSubmittingRef.current) return;

    if (reviewRating === 0) {
      setReviewError("Please select a rating.");
      return;
    }

    reviewSubmittingRef.current = true;
    setReviewSubmitting(true);
    setReviewError("");
    setReviewSuccess("");

    try {
      await api.post(`/products/${reviewItem.product_id}/reviews`, {
        rating: reviewRating,
        title: reviewTitle.trim() || null,
        comment: reviewComment.trim() || null,
      });

      if (!mountedRef.current) return;

      setReviewedProductIds((current) =>
        current.includes(reviewItem.product_id)
          ? current
          : [...current, reviewItem.product_id],
      );

      setReviewSuccess(
        "Your review has been submitted and is waiting for approval.",
      );

      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        if (mountedRef.current) resetReview();
      }, 1200);
    } catch (requestError) {
      if (!mountedRef.current) return;

      setReviewError(
        getErrorMessage(requestError, "Unable to submit your review."),
      );
    } finally {
      reviewSubmittingRef.current = false;

      if (mountedRef.current) setReviewSubmitting(false);
    }
  };

  const reviewDirty =
    !reviewSuccess &&
    (reviewRating > 0 || reviewTitle.trim() !== "" || reviewComment.trim() !== "");

  const cancelOrder = async () => {
    const order = cancelTarget;

    if (!order || cancellingRef.current) return;

    cancellingRef.current = true;
    setCancellingOrderId(order.id);
    setCancelError("");

    try {
      const response = await api.post(`/orders/${order.id}/cancel`);

      if (!mountedRef.current) return;

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === order.id
            ? {
                ...currentOrder,
                ...(response.data || {}),
                items: response.data?.items ?? currentOrder.items,
              }
            : currentOrder,
        ),
      );

      setCancelTarget(null);
    } catch (requestError) {
      if (!mountedRef.current) return;

      setCancelError(
        getErrorMessage(requestError, "Unable to cancel this order."),
      );
      setCancelTarget(null);
    } finally {
      cancellingRef.current = false;

      if (mountedRef.current) setCancellingOrderId(null);
    }
  };

  const resetRefund = () => {
    setRefundOrder(null);
    setRefundReason("");
    setRefundProblem("");
    setRefundFeedback("");
    setRefundError("");
    setRefundSuccess("");
  };

  const openRefundModal = (order) => {
    clearTimeout(closeTimerRef.current);
    resetRefund();
    setRefundOrder(order);
  };

  const closeRefundModal = () => {
    if (refundSubmittingRef.current) return;

    clearTimeout(closeTimerRef.current);
    resetRefund();
  };

  const submitRefund = async () => {
    if (!refundOrder || refundSubmittingRef.current) return;

    if (!refundReason) {
      setRefundError("Please select a reason for the refund.");
      return;
    }

    if (!refundProblem.trim()) {
      setRefundError("Please tell us what went wrong.");
      return;
    }

    const reason = [
      `Reason: ${refundReason}`,
      `What went wrong: ${refundProblem.trim()}`,
      refundFeedback.trim()
        ? `How we can improve: ${refundFeedback.trim()}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    if (reason.length > MAX_REFUND_REASON_LENGTH) {
      setRefundError(
        "Your message is too long. Please shorten it and try again.",
      );
      return;
    }

    refundSubmittingRef.current = true;
    setRefundSubmitting(true);
    setRefundError("");
    setRefundSuccess("");

    try {
      const response = await api.post("/refunds/", {
        order_id: refundOrder.id,
        amount: refundOrder.total_amount,
        reason,
      });

      if (!mountedRef.current) return;

      setRefunds((currentRefunds) => [
        response.data,
        ...currentRefunds.filter((refund) => refund.order_id !== refundOrder.id),
      ]);

      setRefundSuccess("Your refund request has been submitted successfully.");

      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        if (mountedRef.current) resetRefund();
      }, 1600);
    } catch (requestError) {
      if (!mountedRef.current) return;

      setRefundError(
        getErrorMessage(requestError, "Unable to submit your refund request."),
      );
    } finally {
      refundSubmittingRef.current = false;

      if (mountedRef.current) setRefundSubmitting(false);
    }
  };

  const refundDirty =
    !refundSuccess &&
    (refundReason !== "" ||
      refundProblem.trim() !== "" ||
      refundFeedback.trim() !== "");

  const seo = (
    <SEO
      title="Orders"
      description={`View and track your orders on ${siteName}.`}
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
              title="Sign in to view your orders"
              text="Your order history is private to your account."
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

  if (error) {
    return (
      <>
        {seo}

        <div className="min-h-screen bg-[#F1F3F6] px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-md border border-[#E0E0E0] bg-white px-6 py-12 text-center">
            <h1 className="text-xl font-bold text-[#212121]">
              Orders unavailable
            </h1>

            <p role="alert" className="mt-2 text-sm text-[#878787]">
              {error}
            </p>

            <button
              type="button"
              onClick={retryLoad}
              className={`mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#1f65d6] ${FOCUS_RING}`}
            >
              <RotateCcw size={15} />
              Try again
            </button>
          </div>
        </div>
      </>
    );
  }


  return (
    <>
      {seo}

      <div className="min-h-screen bg-[#F1F3F6] pb-16">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* HEADER */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2874F0]">
                Your purchases
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#212121]">
                My Orders
              </h1>

              <p className="mt-1 text-sm text-[#878787]">
                Track your orders, payments and delivery updates.
              </p>
            </div>

            <Link
              to="/shop"
              className={`inline-flex cursor-pointer items-center gap-2 rounded-md text-sm font-semibold text-[#2874F0] hover:text-[#1f65d6] ${FOCUS_RING}`}
            >
              Continue shopping
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* ORDER COUNT */}
          {orders.length > 0 && (
            <div className="mb-5 rounded-md border border-[#E0E0E0] bg-white px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
                  <ShoppingBag size={18} />
                </div>

                <div>
                  <p className="text-sm font-bold text-[#212121]">
                    {orders.length} {orders.length === 1 ? "Order" : "Orders"}
                  </p>

                  <p className="text-xs text-[#878787]">
                    Your complete purchase history
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* REFUNDS UNAVAILABLE NOTICE */}
          {refundsFailed && (
            <div className="mb-5 flex flex-col gap-2 rounded-md border border-[#F2D49A] bg-[#FFF9EC] px-4 py-3 text-sm text-[#8A5A00] sm:flex-row sm:items-center sm:justify-between">
              <p>
                Refund details couldn’t be loaded, so refund status and refund
                requests are hidden for now.
              </p>

              <button
                type="button"
                onClick={retryLoad}
                className={`cursor-pointer self-start rounded-md px-3 py-1.5 text-sm font-semibold text-[#8A5A00] underline sm:self-auto ${FOCUS_RING}`}
              >
                Retry
              </button>
            </div>
          )}

          {/* CANCEL ERROR */}
          {cancelError && (
            <div
              ref={cancelErrorRef}
              role="alert"
              className="mb-5 rounded-md bg-[#FFF1F0] px-4 py-3 text-sm font-medium text-[#D32F2F]"
            >
              {cancelError}
            </div>
          )}

          {/* ORDERS */}
          {orders.length === 0 ? (
            <div className="rounded-md border border-[#E0E0E0] bg-white px-6 py-14">
              <EmptyState
                title="No orders yet"
                text="Once you place an order, it will appear here."
                action="Explore the shop"
                to="/shop"
              />
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {paginatedOrders.map((order) => {
                  const statusText = formatStatus(order.order_status);
                  const statusStyle = getOrderStatusStyle(order.order_status);
                  const StatusIcon = statusStyle.Icon;

                  const refund = refundByOrder.get(order.id);
                  const refundStyle = refund ? getRefundStyle(refund.status) : null;

                  const isCancelled = order.order_status === "cancelled";
                  const isDelivered = order.order_status === "delivered";
                  const isPaid = order.payment_status === "paid";

                  const canRefund =
                    isDelivered &&
                    isPaid &&
                    !refundsFailed &&
                    (!refund || RETRY_REFUND_STATUSES.includes(refund.status));

                  const canCancel = !isCancelled && !isDelivered && !isPaid;

                  const reviewableItems =
                    isDelivered && isPaid
                      ? (order.items || []).filter(
                          (item) => !reviewedProductIds.includes(item.product_id),
                        )
                      : [];

                  const itemCount = order.items?.length || 0;

                  return (
                    <article
                      key={order.id}
                      className={`overflow-hidden rounded-md border bg-white ${
                        isCancelled ? "border-[#F1B8B8]" : "border-[#E0E0E0]"
                      }`}
                    >
                      {/* ORDER HEADER */}
                      <div
                        className={`border-b px-5 py-4 ${
                          isCancelled
                            ? "border-[#F1B8B8] bg-[#FFF5F5]"
                            : "border-[#E0E0E0]"
                        }`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs text-[#878787]">
                              {formatDate(order.created_at)}
                            </p>

                            <h2 className="mt-1 break-all text-sm font-bold text-[#212121]">
                              {order.order_number}
                            </h2>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-full ${statusStyle.icon}`}
                            >
                              <StatusIcon size={16} />
                            </span>

                            <span
                              className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${statusStyle.badge}`}
                            >
                              {statusText}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ORDER BODY */}
                      <div className="px-5 py-5">
                        <div className="grid gap-5 sm:grid-cols-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                              Payment
                            </p>

                            <p className="mt-2 text-sm font-semibold capitalize text-[#212121]">
                              {formatStatus(order.payment_status)}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                              Items
                            </p>

                            <p className="mt-2 text-sm font-semibold text-[#212121]">
                              {itemCount} {itemCount === 1 ? "item" : "items"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                              Total
                            </p>

                            <Price
                              value={order.total_amount}
                              className="mt-2 text-base font-bold text-[#212121]"
                            />
                          </div>
                        </div>

                        {/* REFUND STATUS */}
                        {refund && (
                          <div
                            className={`mt-5 rounded-md border px-4 py-3 ${refundStyle.wrapper}`}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <RotateCcw
                                  size={17}
                                  className={refundStyle.icon}
                                />

                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                                    Refund
                                  </p>

                                  <p className="mt-1 text-sm font-bold text-[#212121]">
                                    {getRefundLabel(refund.status)}
                                  </p>
                                </div>
                              </div>

                              <span
                                className={`rounded-full px-3 py-1.5 text-xs font-bold capitalize ${refundStyle.badge}`}
                              >
                                {formatStatus(refund.status)}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* ITEMS PREVIEW */}
                        {itemCount > 0 && (
                          <div className="mt-5 rounded-md bg-[#FAFAFA] px-4 py-3">
                            <div className="flex items-start gap-3">
                              <Package
                                size={17}
                                className="mt-0.5 shrink-0 text-[#2874F0]"
                              />

                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                                  Order items
                                </p>

                                <p className="mt-1 truncate text-sm font-semibold text-[#212121]">
                                  {order.items
                                    .slice(0, 2)
                                    .map((item) => item.product_name)
                                    .join(", ")}

                                  {itemCount > 2 && ` + ${itemCount - 2} more`}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* FOOTER */}
                      <div
                        className={`flex flex-col gap-3 border-t px-5 py-4 lg:flex-row lg:items-center lg:justify-between ${
                          isCancelled
                            ? "border-[#F1B8B8] bg-[#FFF9F9]"
                            : "border-[#E0E0E0] bg-[#FAFAFA]"
                        }`}
                      >
                        <p className="text-xs text-[#878787]">
                          View the complete order timeline and payment details.
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => {
                                setCancelError("");
                                setCancelTarget(order);
                              }}
                              disabled={cancellingOrderId === order.id}
                              className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-[#C62828] transition hover:bg-[#FFF1F1] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                            >
                              <XCircle size={15} />

                              {cancellingOrderId === order.id
                                ? "Cancelling..."
                                : "Cancel order"}
                            </button>
                          )}

                          {canRefund && (
                            <button
                              type="button"
                              onClick={() => openRefundModal(order)}
                              className={`inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-[#C62828] transition hover:bg-[#FFF1F1] ${FOCUS_RING}`}
                            >
                              <RotateCcw size={15} />
                              Request refund
                            </button>
                          )}

                          {reviewableItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => openReviewModal(item)}
                              title={`Rate ${item.product_name}`}
                              className={`inline-flex max-w-[14rem] cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-[#2874F0] transition hover:bg-[#E8F0FE] ${FOCUS_RING}`}
                            >
                              <Star size={15} className="shrink-0" />

                              <span className="truncate">
                                Rate {item.product_name}
                              </span>
                            </button>
                          ))}

                          <Link
                            to={`/orders/${order.id}`}
                            className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-bold !text-white transition hover:bg-[#1f65d6] ${FOCUS_RING}`}
                          >
                            View order
                            <ArrowRight size={16} />
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* PAGINATION */}
              {totalPages > 1 && (
                <nav
                  aria-label="Orders pagination"
                  className="mt-5 flex items-center justify-between rounded-md border border-[#E0E0E0] bg-white px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#D0D0D0] bg-white px-4 py-2 text-sm font-semibold text-[#555] transition hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
                  >
                    <ArrowLeft size={15} />
                    Previous
                  </button>

                  <div
                    className="text-sm font-semibold text-[#555]"
                    aria-live="polite"
                  >
                    Page {currentPage} of {totalPages}
                  </div>

                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#D0D0D0] bg-white px-4 py-2 text-sm font-semibold text-[#555] transition hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
                  >
                    Next
                    <ArrowRight size={15} />
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {/* CANCEL CONFIRM */}
      {cancelTarget && (
        <Modal
          labelledBy="cancel-dialog-title"
          dismissible={!cancellingOrderId}
          onRequestClose={() => setCancelTarget(null)}
          widthClass="max-w-md"
        >
          <div className="px-6 py-6">
            <h2
              id="cancel-dialog-title"
              className="text-lg font-bold text-[#212121]"
            >
              Cancel this order?
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#878787]">
              Are you sure you want to cancel order{" "}
              <span className="font-semibold text-[#212121]">
                {cancelTarget.order_number}
              </span>
              ? This can’t be undone.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E0E0E0] bg-[#FAFAFA] px-6 py-4">
            <button
              type="button"
              data-autofocus
              onClick={() => setCancelTarget(null)}
              disabled={Boolean(cancellingOrderId)}
              className={`cursor-pointer rounded-md border border-[#D0D0D0] bg-white px-5 py-2.5 text-sm font-semibold text-[#555] hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              Keep order
            </button>

            <button
              type="button"
              onClick={cancelOrder}
              disabled={Boolean(cancellingOrderId)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#C62828] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#AD2020] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              <XCircle size={15} />
              {cancellingOrderId ? "Cancelling..." : "Cancel order"}
            </button>
          </div>
        </Modal>
      )}

      {/* REVIEW MODAL */}
      {reviewItem && (
        <Modal
          labelledBy="review-dialog-title"
          dismissible={!reviewSubmitting && !reviewDirty}
          onRequestClose={closeReviewModal}
        >
          <div className="border-b border-[#E0E0E0] px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id="review-dialog-title"
                  className="break-words text-xl font-bold text-[#212121]"
                >
                  Rate {reviewItem.product_name}
                </h2>

                <p className="mt-1 text-sm text-[#878787]">
                  Share your experience with this product.
                </p>
              </div>

              <button
                type="button"
                onClick={closeReviewModal}
                disabled={reviewSubmitting}
                className={`shrink-0 cursor-pointer rounded-md px-1 text-2xl leading-none text-[#878787] hover:text-[#212121] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            {/* STARS */}
            <div>
              <p
                id="review-rating-label"
                className="mb-2 text-sm font-semibold text-[#212121]"
              >
                Your rating
              </p>

              <div
                role="radiogroup"
                aria-labelledby="review-rating-label"
                className="flex items-center gap-1"
              >
                {[1, 2, 3, 4, 5].map((starValue) => {
                  const filled = starValue <= reviewRating;

                  return (
                    <button
                      key={starValue}
                      type="button"
                      role="radio"
                      aria-checked={starValue === reviewRating}
                      aria-label={`${starValue} ${
                        starValue === 1 ? "star" : "stars"
                      }`}
                      data-autofocus={starValue === 1 ? "" : undefined}
                      onClick={() => setReviewRating(starValue)}
                      disabled={reviewSubmitting}
                      className={`cursor-pointer rounded-md p-0.5 transition hover:scale-110 disabled:cursor-not-allowed ${FOCUS_RING}`}
                    >
                      <Star
                        size={30}
                        className={
                          filled
                            ? "fill-[#FFC107] text-[#FFC107]"
                            : "text-[#D0D0D0]"
                        }
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TITLE */}
            <div>
              <label
                htmlFor="review-title"
                className="mb-2 block text-sm font-semibold text-[#212121]"
              >
                Title{" "}
                <span className="font-normal text-[#878787]">(optional)</span>
              </label>

              <input
                id="review-title"
                type="text"
                value={reviewTitle}
                onChange={(event) => setReviewTitle(event.target.value)}
                maxLength={200}
                disabled={reviewSubmitting}
                placeholder="Give your review a title"
                className="w-full rounded-md border border-[#D0D0D0] px-3 py-2.5 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0] disabled:bg-[#F5F5F5]"
              />
            </div>

            {/* COMMENT */}
            <div>
              <label
                htmlFor="review-comment"
                className="mb-2 block text-sm font-semibold text-[#212121]"
              >
                Your review
              </label>

              <textarea
                id="review-comment"
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                rows={5}
                maxLength={2000}
                disabled={reviewSubmitting}
                placeholder="Tell us what you think about this product..."
                className="w-full resize-none rounded-md border border-[#D0D0D0] px-3 py-2.5 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0] disabled:bg-[#F5F5F5]"
              />
            </div>

            {reviewError && (
              <div
                role="alert"
                className="rounded-md bg-[#FFF1F0] px-4 py-3 text-sm font-medium text-[#D32F2F]"
              >
                {reviewError}
              </div>
            )}

            {reviewSuccess && (
              <div
                role="status"
                className="rounded-md bg-[#E8F5E9] px-4 py-3 text-sm font-medium text-[#2E7D32]"
              >
                {reviewSuccess}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E0E0E0] bg-[#FAFAFA] px-6 py-4">
            <button
              type="button"
              onClick={closeReviewModal}
              disabled={reviewSubmitting}
              className={`cursor-pointer rounded-md border border-[#D0D0D0] bg-white px-5 py-2.5 text-sm font-semibold text-[#555] hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={submitReview}
              disabled={reviewSubmitting || Boolean(reviewSuccess)}
              className={`cursor-pointer rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              {reviewSubmitting ? "Submitting..." : "Submit review"}
            </button>
          </div>
        </Modal>
      )}

      {/* REFUND MODAL */}
      {refundOrder && (
        <Modal
          labelledBy="refund-dialog-title"
          dismissible={!refundSubmitting && !refundDirty}
          onRequestClose={closeRefundModal}
        >
          <div className="border-b border-[#E0E0E0] px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="refund-dialog-title"
                  className="text-xl font-bold text-[#212121]"
                >
                  Request a refund
                </h2>

                <p className="mt-1 text-sm text-[#878787]">
                  We're sorry something went wrong with your order.
                </p>
              </div>

              <button
                type="button"
                onClick={closeRefundModal}
                disabled={refundSubmitting}
                className={`shrink-0 cursor-pointer rounded-md px-1 text-2xl leading-none text-[#878787] hover:text-[#212121] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            {/* ORDER SUMMARY */}
            <div className="rounded-lg bg-[#F8F9F6] px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                    Order
                  </p>

                  <p className="mt-1 break-all text-sm font-bold text-[#212121]">
                    {refundOrder.order_number}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                    Refund amount
                  </p>

                  <Price
                    value={refundOrder.total_amount}
                    className="mt-1 text-sm font-bold text-[#212121]"
                  />
                </div>
              </div>
            </div>

            {/* REASON */}
            <div>
              <label
                htmlFor="refund-reason"
                className="mb-2 block text-sm font-semibold text-[#212121]"
              >
                Why are you requesting a refund?
              </label>

              <select
                id="refund-reason"
                data-autofocus
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                disabled={refundSubmitting}
                className="w-full rounded-md border border-[#D0D0D0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] disabled:bg-[#F5F5F5]"
              >
                <option value="">Select a reason</option>

                {REFUND_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            {/* WHAT WENT WRONG */}
            <div>
              <label
                htmlFor="refund-problem"
                className="mb-2 block text-sm font-semibold text-[#212121]"
              >
                What went wrong?
              </label>

              <textarea
                id="refund-problem"
                value={refundProblem}
                onChange={(event) => setRefundProblem(event.target.value)}
                rows={4}
                maxLength={MAX_REFUND_PROBLEM_LENGTH}
                disabled={refundSubmitting}
                placeholder="Tell us what happened with your order..."
                className="w-full resize-none rounded-md border border-[#D0D0D0] px-3 py-2.5 text-sm outline-none focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] disabled:bg-[#F5F5F5]"
              />
            </div>

            {/* FEEDBACK */}
            <div>
              <label
                htmlFor="refund-feedback"
                className="mb-2 block text-sm font-semibold text-[#212121]"
              >
                How can we improve next time?
                <span className="ml-1 font-normal text-[#878787]">
                  (optional)
                </span>
              </label>

              <textarea
                id="refund-feedback"
                value={refundFeedback}
                onChange={(event) => setRefundFeedback(event.target.value)}
                rows={3}
                maxLength={MAX_REFUND_FEEDBACK_LENGTH}
                disabled={refundSubmitting}
                placeholder="Your feedback helps us improve our service..."
                className="w-full resize-none rounded-md border border-[#D0D0D0] px-3 py-2.5 text-sm outline-none focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828] disabled:bg-[#F5F5F5]"
              />
            </div>

            {/* NOTICE */}
            <div className="rounded-lg bg-[#FFF8E1] px-4 py-3 text-xs leading-5 text-[#795548]">
              Your refund request will be reviewed by our team. You'll be
              notified once the request has been processed.
            </div>

            {refundError && (
              <div
                role="alert"
                className="rounded-md bg-[#FFF1F0] px-4 py-3 text-sm font-medium text-[#D32F2F]"
              >
                {refundError}
              </div>
            )}

            {refundSuccess && (
              <div
                role="status"
                className="rounded-md bg-[#E8F5E9] px-4 py-3 text-sm font-medium text-[#2E7D32]"
              >
                {refundSuccess}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E0E0E0] bg-[#FAFAFA] px-6 py-4">
            <button
              type="button"
              onClick={closeRefundModal}
              disabled={refundSubmitting}
              className={`cursor-pointer rounded-md border border-[#D0D0D0] bg-white px-5 py-2.5 text-sm font-semibold text-[#555] hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={submitRefund}
              disabled={refundSubmitting || Boolean(refundSuccess)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#C62828] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#AD2020] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
            >
              <RotateCcw size={15} />

              {refundSubmitting ? "Submitting..." : "Submit refund request"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default Orders;