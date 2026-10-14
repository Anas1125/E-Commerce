import { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MessageSquareText,
  RefreshCw,
  Search,
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

const PAGE_SIZE = 10;

function apiErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const message = detail
      .map((item) =>
        typeof item === "string" ? item : item?.msg || JSON.stringify(item),
      )
      .filter(Boolean)
      .join("; ");

    return message || fallback;
  }

  return fallback;
}

function formatDate(value) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getStatusClasses(status) {
  if (status === "approved") {
    return "bg-[#E8F5E9] text-[#2E7D32]";
  }

  if (status === "rejected") {
    return "bg-[#FFEBEE] text-[#C62828]";
  }

  return "bg-[#FFF8E1] text-[#F57F17]";
}

function getStatusIcon(status) {
  if (status === "approved") return Check;
  if (status === "rejected") return X;

  return Clock3;
}

function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch reviews from the existing admin API.
  useEffect(() => {
    let cancelled = false;

    api
      .get("/admin/reviews/", {
        params: statusFilter
          ? { review_status: statusFilter }
          : {},
      })
      .then((response) => {
        if (cancelled) return;

        setReviews(
          Array.isArray(response.data) ? response.data : [],
        );
        setError("");
      })
      .catch((requestError) => {
        if (cancelled) return;

        setError(
          apiErrorMessage(
            requestError,
            "Unable to load reviews.",
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, reloadKey]);

  const reload = () => {
    setLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  };

  const refresh = () => {
    reload();
  };

  const changeFilter = (value) => {
    if (value === statusFilter) return;

    setLoading(true);
    setError("");
    setStatusFilter(value);
    setPage(1);
  };

  // Update review status.
  const updateStatus = async (reviewId, nextStatus) => {
    if (updatingId !== null) return;

    setUpdatingId(reviewId);
    setError("");

    try {
      await api.patch(
        `/admin/reviews/${reviewId}/status`,
        null,
        {
          params: { review_status: nextStatus },
        },
      );

      reload();
    } catch (requestError) {
      setError(
        apiErrorMessage(
          requestError,
          "Unable to update review.",
        ),
      );
    } finally {
      setUpdatingId(null);
    }
  };

  // Permanently delete a review.
  const deleteReview = async (reviewId) => {
    if (updatingId !== null) return;

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this review?",
    );

    if (!confirmed) return;

    setUpdatingId(reviewId);
    setError("");

    try {
      await api.delete(`/admin/reviews/${reviewId}`);

      setReviews((current) =>
        current.filter((review) => review.id !== reviewId),
      );
    } catch (requestError) {
      setError(
        apiErrorMessage(
          requestError,
          "Unable to delete review.",
        ),
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const query = search.trim().toLowerCase();

  const matchesSearch = (review, searchQuery) => {
    const authorName = [
      review.user?.first_name,
      review.user?.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    const searchableText = [
      review.id,
      review.product?.name,
      review.title,
      review.comment,
      authorName,
      review.user?.email,
      review.status,
      review.rating,
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(searchQuery);
  };

  const filteredReviews = reviews.filter((review) => {
    if (selectedReviewId !== null) {
      return review.id === selectedReviewId;
    }

    return matchesSearch(review, query);
  });

  const suggestions =
    query && selectedReviewId === null
      ? reviews
          .filter((review) => matchesSearch(review, query))
          .slice(0, 6)
      : [];

  const pageCount = Math.max(
    1,
    Math.ceil(filteredReviews.length / PAGE_SIZE),
  );

  const currentPage = Math.min(page, pageCount);

  const visibleReviews = filteredReviews.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  return (
    <div className="min-w-0 space-y-6">
      {/* Header */}
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
          onClick={refresh}
          disabled={loading}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D5DAD5] bg-white px-4 py-2.5 text-sm font-semibold text-[#486B57] transition hover:bg-[#F5F5F1] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
        >
          <RefreshCw
            size={16}
            aria-hidden="true"
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div
        className="relative z-20"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setShowSuggestions(false);
          }
        }}
      >
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />

        <input
          type="search"
          value={search}
          onFocus={() => {
            if (search.trim() && selectedReviewId === null) {
              setShowSuggestions(true);
            }
          }}
          onChange={(event) => {
            setSearch(event.target.value);
            setSelectedReviewId(null);
            setShowSuggestions(true);
            setPage(1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setShowSuggestions(false);
            }
          }}
          placeholder="Search product, customer, email or review..."
          aria-label="Search reviews"
          aria-autocomplete="list"
          className="w-full rounded-xl border border-[#D5DAD5] bg-white py-3 pl-10 pr-10 text-sm outline-none focus:border-[#486B57] focus:ring-2 focus:ring-[#486B57]/20"
        />

        {search && (
          <button
            type="button"
            aria-label="Clear review search"
            onClick={() => {
              setSearch("");
              setSelectedReviewId(null);
              setShowSuggestions(false);
              setPage(1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
          >
            <X size={18} />
          </button>
        )}

        {showSuggestions &&
          query &&
          selectedReviewId === null &&
          suggestions.length > 0 && (
            <div
              role="listbox"
              aria-label="Matching reviews"
              className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto rounded-xl border border-[#E3E5DF] bg-white shadow-xl"
            >
              {suggestions.map((review) => {
                const author = [
                  review.user?.first_name,
                  review.user?.last_name,
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    key={review.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      setSelectedReviewId(review.id);
                      setSearch(
                        `Review #${review.id} — ${
                          review.product?.name || "Unknown product"
                        }`,
                      );
                      setShowSuggestions(false);
                      setPage(1);
                    }}
                    className="flex w-full items-start gap-3 border-b border-[#E3E5DF] px-4 py-3 text-left last:border-b-0 hover:bg-[#F5F7F3] focus-visible:bg-[#F5F7F3] focus-visible:outline-none"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E8F0E9] text-[#385744]">
                      <MessageSquareText size={17} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-semibold text-[#212121]">
                        {review.product?.name || "Unknown product"}
                      </span>

                      <span className="mt-1 block break-words text-xs text-[#737A74]">
                        {author || "Unknown customer"}
                        {" · "}
                        Review #{review.id}
                      </span>

                      <span className="mt-1 block break-all text-xs text-[#737A74]">
                        {review.user?.email || "No email"}
                      </span>
                    </span>

                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold capitalize ${getStatusClasses(
                        review.status,
                      )}`}
                    >
                      {review.status}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
      </div>


      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const active = statusFilter === filter.value;

          return (
            <button
              key={filter.value || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => changeFilter(filter.value)}
              className={`min-h-10 cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition ${
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

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#F1C4C4] bg-[#FFF5F5] px-4 py-3 text-sm font-medium text-[#C62828]"
        >
          <p>{error}</p>

          {!loading && (
            <button
              type="button"
              onClick={refresh}
              className="mt-2 font-semibold underline"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div
          role="status"
          className="rounded-2xl border border-[#E3E5DF] bg-white px-6 py-16 text-center"
        >
          <RefreshCw
            size={24}
            aria-hidden="true"
            className="mx-auto animate-spin text-[#486B57]"
          />

          <p className="mt-3 text-sm text-[#737A74]">
            Loading reviews...
          </p>
        </div>
      ) : filteredReviews.length === 0 ? (
        /* Empty state */
        <div className="rounded-2xl border border-[#E3E5DF] bg-white px-5 py-12 text-center sm:px-6 sm:py-16">
          <MessageSquareText
            size={32}
            aria-hidden="true"
            className="mx-auto text-[#A0A8A1]"
          />

          <h2 className="mt-4 text-lg font-bold text-[#212121]">
            No reviews found
          </h2>

          <p className="mt-1 text-sm text-[#737A74]">
            {query
              ? `No reviews match "${search.trim()}".`
              : statusFilter
                ? `There are no ${statusFilter} reviews.`
                : "There are no reviews to display."}
          </p>

          {query && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              className="mt-4 text-sm font-semibold text-[#486B57] underline"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Results count */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[#737A74]">
              {filteredReviews.length}{" "}
              {filteredReviews.length === 1 ? "review" : "reviews"} found
            </p>

            <p className="text-xs text-[#737A74]">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(
                currentPage * PAGE_SIZE,
                filteredReviews.length,
              )}{" "}
              of {filteredReviews.length}
            </p>
          </div>

          {/* Review cards */}
          <div className="space-y-4">
            {visibleReviews.map((review) => {
              const StatusIcon = getStatusIcon(review.status);
              const isUpdating = updatingId === review.id;
              const rating = Math.min(
                5,
                Math.max(0, Number(review.rating) || 0),
              );

              const authorName = [
                review.user?.first_name,
                review.user?.last_name,
              ]
                .filter(Boolean)
                .join(" ")
                .trim() || "Unknown";

              return (
                <article
                  key={review.id}
                  className="min-w-0 overflow-hidden rounded-2xl border border-[#E3E5DF] bg-white"
                >
                  {/* Review header */}
                  <div className="flex flex-col gap-3 border-b border-[#E3E5DF] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-words text-base font-bold text-[#212121]">
                          {review.product?.name || "Unknown product"}
                        </h2>

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${getStatusClasses(
                            review.status,
                          )}`}
                        >
                          <StatusIcon size={13} aria-hidden="true" />
                          {review.status}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-[#737A74]">
                        Review #{review.id}
                      </p>
                    </div>

                    <div
                      className="flex items-center gap-1 self-start"
                      role="img"
                      aria-label={`${rating} out of 5 stars`}
                    >
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          size={17}
                          aria-hidden="true"
                          className={
                            index < rating
                              ? "fill-[#FFC107] text-[#FFC107]"
                              : "text-[#D5D5D5]"
                          }
                        />
                      ))}
                    </div>
                  </div>

                  {/* Review content */}
                  <div className="px-4 py-4 sm:px-5 sm:py-5">
                    {review.title && (
                      <h3 className="break-words text-base font-bold text-[#212121]">
                        {review.title}
                      </h3>
                    )}

                    {review.comment && (
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#5C655E]">
                        {review.comment}
                      </p>
                    )}

                    <div className="mt-5 flex flex-col gap-3 rounded-xl bg-[#F8F9F6] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-[#212121]">
                          {authorName}
                        </p>

                        <p className="mt-0.5 break-all text-xs text-[#737A74]">
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
                          {formatDate(review.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Review actions */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#E3E5DF] bg-[#FAFAF8] px-4 py-4 sm:px-5">
                    {review.status !== "approved" && (
                      <button
                        type="button"
                        disabled={isUpdating || updatingId !== null}
                        onClick={() =>
                          updateStatus(review.id, "approved")
                        }
                        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg bg-[#385744] px-3 py-2 text-sm font-bold text-white transition hover:bg-[#2E4938] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                      >
                        <Check size={15} aria-hidden="true" />
                        Approve
                      </button>
                    )}

                    {review.status !== "rejected" && (
                      <button
                        type="button"
                        disabled={isUpdating || updatingId !== null}
                        onClick={() =>
                          updateStatus(review.id, "rejected")
                        }
                        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#E0B5B5] bg-white px-3 py-2 text-sm font-bold text-[#C62828] transition hover:bg-[#FFF5F5] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                      >
                        <X size={15} aria-hidden="true" />
                        Reject
                      </button>
                    )}

                    {review.status !== "pending" && (
                      <button
                        type="button"
                        disabled={isUpdating || updatingId !== null}
                        onClick={() =>
                          updateStatus(review.id, "pending")
                        }
                        className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#D5DAD5] bg-white px-3 py-2 text-sm font-semibold text-[#5C655E] transition hover:bg-[#F5F5F1] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
                      >
                        <Clock3 size={15} aria-hidden="true" />
                        Set pending
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isUpdating || updatingId !== null}
                      onClick={() => deleteReview(review.id)}
                      className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#E0B5B5] bg-white px-3 py-2 text-sm font-semibold text-[#C62828] transition hover:bg-[#FFF5F5] disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto sm:px-4"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      Delete
                    </button>

                    {isUpdating && (
                      <span
                        role="status"
                        className="w-full text-xs text-[#737A74] sm:w-auto"
                      >
                        Updating review...
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-3 rounded-xl border border-[#E3E5DF] bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[#737A74] sm:text-sm">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(
                currentPage * PAGE_SIZE,
                filteredReviews.length,
              )}{" "}
              of {filteredReviews.length} reviews
            </p>

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <button
                type="button"
                disabled={currentPage <= 1 || loading}
                onClick={() =>
                  setPage((current) => Math.max(1, current - 1))
                }
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#D5DAD5] px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft size={16} />
                Previous
              </button>

              <span className="whitespace-nowrap text-xs text-[#737A74]">
                {currentPage} / {pageCount}
              </span>

              <button
                type="button"
                disabled={currentPage >= pageCount || loading}
                onClick={() =>
                  setPage((current) =>
                    Math.min(pageCount, current + 1),
                  )
                }
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#D5DAD5] px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default Reviews;