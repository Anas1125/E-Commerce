import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Package,
  ShoppingBag,
  Truck,
  RotateCcw,
} from "lucide-react";

import api from "../services/api";
import useAuth from "../context/useAuth";

import {
  EmptyState,
  LoadingState,
  Price,
} from "../components/Storefront";

const REFUND_REASONS = [
  "Product damaged",
  "Wrong product received",
  "Product not as described",
  "Product missing parts",
  "Product stopped working",
  "Changed my mind",
  "Other",
];

function Orders() {
  const { isAuthenticated } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Review state
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  // Refund state
  const [refundOrder, setRefundOrder] = useState(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundProblem, setRefundProblem] = useState("");
  const [refundFeedback, setRefundFeedback] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [refundSuccess, setRefundSuccess] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;

    const fetchOrders = async () => {
      try {
        const response = await api.get("/orders/");

        if (!cancelled) {
          setOrders(response.data);
          setError("");
          setLoading(false);
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError.response?.data?.detail ||
              "Unable to load orders.",
          );
          setLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const getStatusIcon = (status) => {
    if (status === "delivered") {
      return CheckCircle2;
    }

    if (
      status === "shipped" ||
      status === "out_for_delivery"
    ) {
      return Truck;
    }

    if (
      status === "processing" ||
      status === "confirmed"
    ) {
      return Package;
    }

    return Clock3;
  };

  // -----------------------------
  // REVIEW
  // -----------------------------

  const openReviewModal = (item) => {
    setReviewItem(item);
    setReviewRating(0);
    setReviewTitle("");
    setReviewComment("");
    setReviewError("");
    setReviewSuccess("");
  };

  const closeReviewModal = () => {
    if (reviewSubmitting) {
      return;
    }

    setReviewItem(null);
    setReviewRating(0);
    setReviewTitle("");
    setReviewComment("");
    setReviewError("");
    setReviewSuccess("");
  };

  const submitReview = async () => {
    if (!reviewItem) {
      return;
    }

    if (reviewRating === 0) {
      setReviewError("Please select a rating.");
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewError("");
      setReviewSuccess("");

      await api.post(
        `/products/${reviewItem.product_id}/reviews`,
        {
          rating: reviewRating,
          title: reviewTitle.trim() || null,
          comment: reviewComment.trim() || null,
        },
      );

      setReviewSuccess(
        "Your review has been submitted and is waiting for approval.",
      );

      setTimeout(() => {
        closeReviewModal();
      }, 1200);
    } catch (requestError) {
      setReviewError(
        requestError.response?.data?.detail ||
          "Unable to submit your review.",
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  // -----------------------------
  // REFUND
  // -----------------------------

  const openRefundModal = (order) => {
    setRefundOrder(order);
    setRefundReason("");
    setRefundProblem("");
    setRefundFeedback("");
    setRefundError("");
    setRefundSuccess("");
  };

  const closeRefundModal = () => {
    if (refundSubmitting) {
      return;
    }

    setRefundOrder(null);
    setRefundReason("");
    setRefundProblem("");
    setRefundFeedback("");
    setRefundError("");
    setRefundSuccess("");
  };

  const submitRefund = async () => {
    if (!refundOrder) {
      return;
    }

    if (!refundReason) {
      setRefundError("Please select a reason for the refund.");
      return;
    }

    if (!refundProblem.trim()) {
      setRefundError("Please tell us what went wrong.");
      return;
    }

    try {
      setRefundSubmitting(true);
      setRefundError("");
      setRefundSuccess("");

      const reason = [
        `Reason: ${refundReason}`,
        `What went wrong: ${refundProblem.trim()}`,
        refundFeedback.trim()
          ? `How we can improve: ${refundFeedback.trim()}`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      await api.post("/refunds/", {
        order_id: refundOrder.id,
        amount: refundOrder.total_amount,
        reason,
      });

      setRefundSuccess(
        "Your refund request has been submitted successfully.",
      );

      setTimeout(() => {
        closeRefundModal();
      }, 1600);
    } catch (requestError) {
      setRefundError(
        requestError.response?.data?.detail ||
          "Unable to submit your refund request.",
      );
    } finally {
      setRefundSubmitting(false);
    }
  };

  if (loading && isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
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
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <EmptyState
            title="Orders unavailable"
            text={error}
          />
        </div>
      </div>
    );
  }

  return (
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
            className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#2874F0] hover:text-[#1f65d6]"
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
                  {orders.length}{" "}
                  {orders.length === 1 ? "Order" : "Orders"}
                </p>

                <p className="text-xs text-[#878787]">
                  Your complete purchase history
                </p>
              </div>
            </div>
          </div>
        )}

        {/* EMPTY */}
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
          <div className="space-y-4">
            {orders.map((order) => {
              const status = order.order_status.replaceAll(
                "_",
                " ",
              );

              const StatusIcon = getStatusIcon(
                order.order_status,
              );

              const canRefund =
                order.order_status === "delivered" &&
                order.payment_status === "paid";

              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-md border border-[#E0E0E0] bg-white"
                >
                  {/* ORDER HEADER */}
                  <div className="border-b border-[#E0E0E0] px-5 py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs text-[#878787]">
                          {new Date(
                            order.created_at,
                          ).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            },
                          )}
                        </p>

                        <h2 className="mt-1 text-sm font-bold text-[#212121]">
                          {order.order_number}
                        </h2>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8F5E9] text-[#388E3C]">
                          <StatusIcon size={16} />
                        </span>

                        <span className="rounded-full bg-[#E8F5E9] px-3 py-1.5 text-xs font-bold capitalize text-[#388E3C]">
                          {status}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ORDER BODY */}
                  <div className="px-5 py-5">
                    <div className="grid gap-5 sm:grid-cols-3">

                      {/* PAYMENT */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                          Payment
                        </p>

                        <p className="mt-2 text-sm font-semibold capitalize text-[#212121]">
                          {order.payment_status}
                        </p>
                      </div>

                      {/* ITEMS */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                          Items
                        </p>

                        <p className="mt-2 text-sm font-semibold text-[#212121]">
                          {order.items?.length || 0}{" "}
                          {order.items?.length === 1
                            ? "item"
                            : "items"}
                        </p>
                      </div>

                      {/* TOTAL */}
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

                    {/* ITEMS PREVIEW */}
                    {order.items?.length > 0 && (
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
                                .map(
                                  (item) =>
                                    item.product_name,
                                )
                                .join(", ")}

                              {order.items.length > 2 &&
                                ` + ${
                                  order.items.length - 2
                                } more`}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* FOOTER */}
                  <div className="flex flex-col gap-3 border-t border-[#E0E0E0] bg-[#FAFAFA] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-[#878787]">
                      View the complete order timeline and
                      payment details.
                    </p>

                    <div className="flex flex-wrap items-center gap-2">

                      {/* REFUND */}
                      {canRefund && (
                        <button
                          type="button"
                          onClick={() =>
                            openRefundModal(order)
                          }
                          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-[#C62828] transition hover:bg-[#FFF1F1]"
                        >
                          <RotateCcw size={15} />
                          Request refund
                        </button>
                      )}

                      {/* RATE PRODUCT */}
                      {order.order_status === "delivered" &&
                        order.payment_status === "paid" &&
                        order.items?.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() =>
                              openReviewModal(item)
                            }
                            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold text-[#2874F0] transition hover:bg-[#E8F0FE]"
                          >
                            Rate product
                            <span className="text-base">
                              ⭐
                            </span>
                          </button>
                        ))}

                      {/* VIEW ORDER */}
                      <Link
                        to={`/orders/${order.id}`}
                        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
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
        )}
      </div>

      {/* ========================= */}
      {/* REVIEW MODAL */}
      {/* ========================= */}

      {reviewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeReviewModal();
            }
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">

            <div className="border-b border-[#E0E0E0] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#212121]">
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
                  className="cursor-pointer text-2xl leading-none text-[#878787] hover:text-[#212121]"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="space-y-5 px-6 py-6">

              {/* STARS */}
              <div>
                <p className="mb-2 text-sm font-semibold text-[#212121]">
                  Your rating
                </p>

                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setReviewRating(star)
                      }
                      disabled={reviewSubmitting}
                      className="cursor-pointer text-3xl leading-none transition hover:scale-110"
                    >
                      <span
                        className={
                          star <= reviewRating
                            ? "text-[#FFC107]"
                            : "text-[#D0D0D0]"
                        }
                      >
                        ★
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* TITLE */}
              <div>
                <label
                  htmlFor="review-title"
                  className="mb-2 block text-sm font-semibold text-[#212121]"
                >
                  Title{" "}
                  <span className="font-normal text-[#878787]">
                    (optional)
                  </span>
                </label>

                <input
                  id="review-title"
                  type="text"
                  value={reviewTitle}
                  onChange={(event) =>
                    setReviewTitle(event.target.value)
                  }
                  maxLength={200}
                  disabled={reviewSubmitting}
                  placeholder="Give your review a title"
                  className="w-full rounded-md border border-[#D0D0D0] px-3 py-2.5 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
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
                  onChange={(event) =>
                    setReviewComment(event.target.value)
                  }
                  rows={5}
                  disabled={reviewSubmitting}
                  placeholder="Tell us what you think about this product..."
                  className="w-full resize-none rounded-md border border-[#D0D0D0] px-3 py-2.5 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                />
              </div>

              {reviewError && (
                <div className="rounded-md bg-[#FFF1F0] px-4 py-3 text-sm font-medium text-[#D32F2F]">
                  {reviewError}
                </div>
              )}

              {reviewSuccess && (
                <div className="rounded-md bg-[#E8F5E9] px-4 py-3 text-sm font-medium text-[#2E7D32]">
                  {reviewSuccess}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#E0E0E0] bg-[#FAFAFA] px-6 py-4">
              <button
                type="button"
                onClick={closeReviewModal}
                disabled={reviewSubmitting}
                className="rounded-md border border-[#D0D0D0] bg-white px-5 py-2.5 text-sm font-semibold text-[#555] hover:bg-[#F5F5F5] cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitReview}
                disabled={reviewSubmitting}
                className="rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1f65d6] disabled:opacity-60 cursor-pointer"
              >
                {reviewSubmitting
                  ? "Submitting..."
                  : "Submit review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================= */}
      {/* REFUND MODAL */}
      {/* ========================= */}

      {refundOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeRefundModal();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-2xl">

            {/* HEADER */}
            <div className="border-b border-[#E0E0E0] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#212121]">
                    Request a refund
                  </h2>

                  <p className="mt-1 text-sm text-[#878787]">
                    We're sorry something went wrong with your
                    order.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeRefundModal}
                  disabled={refundSubmitting}
                  className="cursor-pointer text-2xl leading-none text-[#878787] hover:text-[#212121]"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {/* BODY */}
            <div className="space-y-5 px-6 py-6">

              {/* ORDER SUMMARY */}
              <div className="rounded-lg bg-[#F8F9F6] px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                      Order
                    </p>

                    <p className="mt-1 text-sm font-bold text-[#212121]">
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
                  value={refundReason}
                  onChange={(event) =>
                    setRefundReason(event.target.value)
                  }
                  disabled={refundSubmitting}
                  className="w-full rounded-md border border-[#D0D0D0] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828]"
                >
                  <option value="">
                    Select a reason
                  </option>

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
                  onChange={(event) =>
                    setRefundProblem(event.target.value)
                  }
                  rows={4}
                  maxLength={500}
                  disabled={refundSubmitting}
                  placeholder="Tell us what happened with your order..."
                  className="w-full resize-none rounded-md border border-[#D0D0D0] px-3 py-2.5 text-sm outline-none focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828]"
                />
              </div>

              {/* IMPROVEMENT FEEDBACK */}
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
                  onChange={(event) =>
                    setRefundFeedback(event.target.value)
                  }
                  rows={3}
                  maxLength={500}
                  disabled={refundSubmitting}
                  placeholder="Your feedback helps us improve our service..."
                  className="w-full resize-none rounded-md border border-[#D0D0D0] px-3 py-2.5 text-sm outline-none focus:border-[#C62828] focus:ring-1 focus:ring-[#C62828]"
                />
              </div>

              {/* NOTICE */}
              <div className="rounded-lg bg-[#FFF8E1] px-4 py-3 text-xs leading-5 text-[#795548]">
                Your refund request will be reviewed by our team.
                You'll be notified once the request has been
                processed.
              </div>

              {/* ERROR */}
              {refundError && (
                <div className="rounded-md bg-[#FFF1F0] px-4 py-3 text-sm font-medium text-[#D32F2F]">
                  {refundError}
                </div>
              )}

              {/* SUCCESS */}
              {refundSuccess && (
                <div className="rounded-md bg-[#E8F5E9] px-4 py-3 text-sm font-medium text-[#2E7D32]">
                  {refundSuccess}
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div className="flex items-center justify-end gap-3 border-t border-[#E0E0E0] bg-[#FAFAFA] px-6 py-4">
              <button
                type="button"
                onClick={closeRefundModal}
                disabled={refundSubmitting}
                className="rounded-md border border-[#D0D0D0] bg-white px-5 py-2.5 text-sm font-semibold text-[#555] hover:bg-[#F5F5F5] cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={submitRefund}
                disabled={refundSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-[#C62828] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#AD2020] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
              >
                <RotateCcw size={15} />

                {refundSubmitting
                  ? "Submitting..."
                  : "Submit refund request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Orders;