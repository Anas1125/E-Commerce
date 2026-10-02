import { useEffect, useState } from "react";
import {
  Check,
  Clock3,
  MessageSquareText,
  RefreshCw,
  Star,
  Trash2,
  X,
} from "lucide-react";

import api from "../services/api";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
];

function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const loadReviews = async () => {
    try {
        setLoading(true);
        setError("");

        const response = await api.get("/admin/reviews/", {
        params: statusFilter
            ? { review_status: statusFilter }
            : {},
        });

        setReviews(response.data);
    } catch (requestError) {
        setError(
        requestError.response?.data?.detail ||
            "Unable to load reviews.",
        );
    } finally {
        setLoading(false);
    }
    };

    useEffect(() => {
    let cancelled = false;

    const fetchReviews = async () => {
        try {
        const response = await api.get("/admin/reviews/", {
            params: statusFilter
            ? { review_status: statusFilter }
            : {},
        });

        if (!cancelled) {
            setReviews(response.data);
            setError("");
            setLoading(false);
        }
        } catch (requestError) {
        if (!cancelled) {
            setError(
            requestError.response?.data?.detail ||
                "Unable to load reviews.",
            );
            setLoading(false);
        }
        }
    };

    fetchReviews();

    return () => {
        cancelled = true;
    };
    }, [statusFilter]);

  const updateStatus = async (reviewId, nextStatus) => {
    try {
      setUpdatingId(reviewId);
      setError("");

      await api.patch(
        `/admin/reviews/${reviewId}/status`,
        null,
        {
          params: {
            review_status: nextStatus,
          },
        },
      );

      await loadReviews();
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Unable to update review.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteReview = async (reviewId) => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this review?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setUpdatingId(reviewId);
      setError("");

      await api.delete(`/admin/reviews/${reviewId}`);

      setReviews((currentReviews) =>
        currentReviews.filter(
          (review) => review.id !== reviewId,
        ),
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Unable to delete review.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusClasses = (status) => {
    if (status === "approved") {
      return "bg-[#E8F5E9] text-[#2E7D32]";
    }

    if (status === "rejected") {
      return "bg-[#FFEBEE] text-[#C62828]";
    }

    return "bg-[#FFF8E1] text-[#F57F17]";
  };

  const getStatusIcon = (status) => {
    if (status === "approved") {
      return Check;
    }

    if (status === "rejected") {
      return X;
    }

    return Clock3;
  };

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Store management</p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#212121]">
            Reviews
          </h1>

          <p className="mt-1 text-sm text-[#737A74]">
            Review customer feedback and manage published reviews.
          </p>
        </div>

        <button
          type="button"
          onClick={loadReviews}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D5DAD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#486B57] transition hover:bg-[#F5F5F1] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const active = statusFilter === filter.value;

          return (
            <button
              key={filter.value || "all"}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[#385744] text-white"
                  : "border border-[#D5DAD5] bg-white text-[#5C655E] hover:bg-[#F5F5F1]"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-[#F1C4C4] bg-[#FFF5F5] px-4 py-3 text-sm font-medium text-[#C62828]">
          {error}
        </div>
      )}

      {/* LOADING */}
      {loading ? (
        <div className="rounded-2xl border border-[#E3E5DF] bg-white px-6 py-16 text-center">
          <RefreshCw
            size={24}
            className="mx-auto animate-spin text-[#486B57]"
          />

          <p className="mt-3 text-sm text-[#737A74]">
            Loading reviews...
          </p>
        </div>
      ) : reviews.length === 0 ? (
        /* EMPTY */
        <div className="rounded-2xl border border-[#E3E5DF] bg-white px-6 py-16 text-center">
          <MessageSquareText
            size={32}
            className="mx-auto text-[#A0A8A1]"
          />

          <h2 className="mt-4 text-lg font-bold text-[#212121]">
            No reviews found
          </h2>

          <p className="mt-1 text-sm text-[#737A74]">
            There are no reviews matching this filter.
          </p>
        </div>
      ) : (
        /* REVIEWS */
        <div className="space-y-4">
          {reviews.map((review) => {
            const StatusIcon = getStatusIcon(review.status);
            const isUpdating = updatingId === review.id;

            return (
              <article
                key={review.id}
                className="overflow-hidden rounded-2xl border border-[#E3E5DF] bg-white"
              >
                {/* REVIEW HEADER */}
                <div className="flex flex-col gap-4 border-b border-[#E3E5DF] px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-bold text-[#212121]">
                        {review.product?.name ||
                          "Unknown product"}
                      </h2>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${getStatusClasses(
                          review.status,
                        )}`}
                      >
                        <StatusIcon size={13} />
                        {review.status}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-[#737A74]">
                      Review #{review.id}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map(
                      (_, index) => (
                        <Star
                          key={index}
                          size={17}
                          className={
                            index < review.rating
                              ? "fill-[#FFC107] text-[#FFC107]"
                              : "text-[#D5D5D5]"
                          }
                        />
                      ),
                    )}
                  </div>
                </div>

                {/* REVIEW CONTENT */}
                <div className="px-5 py-5">
                  {review.title && (
                    <h3 className="text-base font-bold text-[#212121]">
                      {review.title}
                    </h3>
                  )}

                  {review.comment && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#5C655E]">
                      {review.comment}
                    </p>
                  )}

                  <div className="mt-5 flex flex-col gap-3 rounded-xl bg-[#F8F9F6] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#212121]">
                        {review.user?.first_name || "Unknown"}{" "}
                        {review.user?.last_name || ""}
                      </p>

                      <p className="mt-0.5 text-xs text-[#737A74]">
                        {review.user?.email || "No email"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {review.is_verified_purchase && (
                        <span className="rounded-full bg-[#E8F5E9] px-3 py-1.5 text-xs font-bold text-[#2E7D32]">
                          ✓ Verified purchase
                        </span>
                      )}

                      <span className="text-xs text-[#737A74]">
                        {new Date(
                          review.created_at,
                        ).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="flex flex-wrap items-center gap-2 border-t border-[#E3E5DF] bg-[#FAFAF8] px-5 py-4">
                  {review.status !== "approved" && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        updateStatus(
                          review.id,
                          "approved",
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-lg bg-[#385744] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#2E4938] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Check size={15} />
                      Approve
                    </button>
                  )}

                  {review.status !== "rejected" && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        updateStatus(
                          review.id,
                          "rejected",
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-[#E0B5B5] bg-white px-4 py-2 text-sm font-bold text-[#C62828] transition hover:bg-[#FFF5F5] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X size={15} />
                      Reject
                    </button>
                  )}

                  {review.status !== "pending" && (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() =>
                        updateStatus(
                          review.id,
                          "pending",
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-lg border border-[#D5DAD5] bg-white px-4 py-2 text-sm font-semibold text-[#5C655E] transition hover:bg-[#F5F5F1] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Clock3 size={15} />
                      Set pending
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() =>
                      deleteReview(review.id)
                    }
                    className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#E0B5B5] bg-white px-4 py-2 text-sm font-semibold text-[#C62828] transition hover:bg-[#FFF5F5] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Reviews;