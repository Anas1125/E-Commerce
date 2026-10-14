import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  X,
  XCircle,
} from "lucide-react";
import useAdminNotice from "../hooks/useAdminNotice";
import api from "../services/api";
import {
  AdminEmpty,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  Badge,
} from "../components/AdminUI";

const refundStatuses = ["requested", "approved", "completed", "rejected"];
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

  return date.toLocaleDateString("en-IN");
}

function formatPaymentMethod(value) {
  const method = String(value || "").trim().toLowerCase();

  const labels = {
    cod: "Cash on Delivery",
    upi: "UPI",
    card: "Card",
    netbanking: "Net Banking",
    wallet: "Wallet",
    online: "Online payment",
    razorpay: "Razorpay (method not recorded)",
  };

  return labels[method] || value || "Not recorded";
}

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function AdminRefunds() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [gatewayId, setGatewayId] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState(null);

  const modalRef = useRef(null);
  const triggerRef = useRef(null);
  const busyRef = useRef(false);

  const { notice, notify, clear } = useAdminNotice();


  useEffect(() => {
    let cancelled = false;

    api
      .get("/admin/refunds/", {
        params: filter ? { refund_status: filter } : {},
      })
      .then((response) => {
        if (cancelled) return;

        setRows(Array.isArray(response.data) ? response.data : []);
        setLoadError("");
      })
      .catch((error) => {
        if (cancelled) return;

        const message = apiErrorMessage(
          error,
          "Unable to load refunds.",
        );

        setLoadError(message);
        notify(message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey, notify]);


  useEffect(() => {
    if (!detail) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFrame = window.requestAnimationFrame(() => {
      modalRef.current?.focus();
    });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (!busyRef.current) {
          setDetail(null);
          setGatewayId("");
        }

        return;
      }

      if (event.key !== "Tab" || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);

      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    };
  }, [detail]);


  const reload = () => {
    setLoading(true);
    setLoadError("");
    setReloadKey((key) => key + 1);
  };

  const retry = () => reload();

  const changeFilter = (event) => {
    setLoading(true);
    setLoadError("");
    setFilter(event.target.value);
    setPage(1);
  };

  const openDetail = (refund, trigger) => {
    triggerRef.current = trigger;
    setGatewayId("");
    setDetail(refund);
  };

  const closeDetail = () => {
    if (busyRef.current) return;

    setDetail(null);
    setGatewayId("");
  };


  const approve = async (refund) => {
    if (pendingId !== null) return;

    if (!window.confirm(`Approve refund request #${refund.id}?`)) {
      return;
    }

    setPendingId(refund.id);

    try {
      await api.post(`/refunds/${refund.id}/approve`);

      notify("Refund approved.");
      reload();
    } catch (error) {
      notify(
        apiErrorMessage(error, "Unable to approve refund."),
        "error",
      );
    } finally {
      setPendingId(null);
    }
  };


  const reject = async (refund) => {
    if (pendingId !== null) return;

    const response = window.prompt(
      `Optional reason for declining refund request #${refund.id}:`,
    );

    if (response === null) return;

    const reason = response.trim();

    if (
      !window.confirm(
        `Decline refund request #${refund.id}? The customer will be notified.`,
      )
    ) {
      return;
    }

    setPendingId(refund.id);

    try {
      await api.post(`/refunds/${refund.id}/reject`, {
        reason: reason || null,
      });

      notify("Refund request declined.");
      reload();
    } catch (error) {
      notify(
        apiErrorMessage(error, "Unable to decline refund."),
        "error",
      );
    } finally {
      setPendingId(null);
    }
  };

  const complete = async (event) => {
    event.preventDefault();

    if (busyRef.current || !detail) return;

    const reference = gatewayId.trim();

    if (!reference) return;

    const isCod = detail?.payment_method?.toLowerCase() === "cod";

    const referenceLabel = isCod
      ? "manual transfer reference"
      : "gateway refund reference";

    if (
      !window.confirm(
        `Record refund #${detail.id} as completed with ${referenceLabel} "${reference}"? This cannot be undone here.`,
      )
    ) {
      return;
    }

    busyRef.current = true;
    setBusy(true);

    try {
      await api.post(`/refunds/${detail.id}/complete`, null, {
        params: isCod
          ? { manual_refund_reference: reference }
          : { gateway_refund_id: reference },
      });

      notify("Refund marked completed.");
      setDetail(null);
      setGatewayId("");
      reload();
    } catch (error) {
      notify(
        apiErrorMessage(error, "Unable to complete refund."),
        "error",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const query = search.trim().toLowerCase();

  const filteredRows = rows.filter((refund) => {
    const searchable = [
      refund.id,
      refund.order_id,
      refund.customer_name,
      refund.customer_email,
      refund.reason,
      refund.status,
      refund.payment_method,
      refund.gateway_payment_id,
      refund.gateway_refund_id,
      refund.manual_refund_reference,
    ]
      .filter((value) => value !== null && value !== undefined)
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });

  const pageCount = Math.max(
    1,
    Math.ceil(filteredRows.length / PAGE_SIZE),
  );

  const currentPage = Math.min(page, pageCount);

  const visibleRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const renderActions = (refund, mobile = false) => (
    <div
      className={`flex flex-wrap items-center gap-1 ${
        mobile ? "justify-end" : ""
      }`}
    >
      <button
        type="button"
        aria-label={`View refund ${refund.id}`}
        onClick={(event) => openDetail(refund, event.currentTarget)}
        className="inline-flex min-h-10 items-center gap-1 rounded-lg p-2 text-sm hover:bg-[#DCE7DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
      >
        <Eye size={16} aria-hidden="true" />
        {mobile ? "View" : null}
      </button>

      {refund.status === "requested" && (
        <>
          <button
            type="button"
            disabled={pendingId !== null}
            aria-label={`Approve refund ${refund.id}`}
            onClick={() => approve(refund)}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg p-2 text-sm text-[#486B57] hover:bg-[#DCE7DE] disabled:opacity-50"
          >
            <Check size={16} aria-hidden="true" />
            {mobile ? "Approve" : null}
          </button>

          <button
            type="button"
            disabled={pendingId !== null}
            aria-label={`Decline refund ${refund.id}`}
            onClick={() => reject(refund)}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg p-2 text-sm text-[#8b4033] hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle size={16} aria-hidden="true" />
            {mobile ? "Decline" : null}
          </button>

          {pendingId === refund.id && (
            <span className="text-xs text-[#737A74]">
              Updating…
            </span>
          )}
        </>
      )}
    </div>
  );

  return (
    <>
      <AdminPageHeader
        title="Refunds"
        description="Review refund requests and record gateway completion."
      />

      <AdminNotice notice={notice} onClose={clear} />

      <AdminPanel>
        {/* Search and status filter */}
        <div className="flex flex-col gap-3 border-b border-[#E3E5DF] p-4 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search refund, order, customer or email..."
              aria-label="Search refunds"
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-10 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
            />

            {search && (
              <button
                type="button"
                aria-label="Clear refund search"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <select
            aria-label="Filter refund status"
            className="field w-full sm:max-w-56"
            value={filter}
            onChange={changeFilter}
          >
            <option value="">All refund statuses</option>

            {refundStatuses.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-[#737A74]">
            Loading refunds…
          </div>
        ) : loadError ? (
          <div className="px-5 py-8">
            <div role="alert" className="text-sm text-[#8b4033]">
              {loadError}
            </div>

            <button
              type="button"
              onClick={retry}
              className="button-secondary mt-3"
            >
              Retry
            </button>
          </div>
        ) : filteredRows.length ? (
          <>
            {/* Mobile refund cards */}
            <div className="space-y-3 p-3 xl:hidden">
              {visibleRows.map((refund) => (
                <article
                  key={refund.id}
                  className="min-w-0 rounded-xl border border-[#E3E5DF] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">
                        Refund #{refund.id}
                      </h3>

                      <p className="mt-1 text-xs text-[#737A74]">
                        Order #{refund.order_id}
                      </p>
                    </div>

                    <Badge>{refund.status}</Badge>
                  </div>

                  <div className="mt-3 space-y-1 text-sm">
                    <p className="break-words font-medium">
                      {refund.customer_name || "Customer"}
                    </p>

                    <p className="break-all text-xs text-[#737A74]">
                      {refund.customer_email || "—"}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 border-t border-[#E3E5DF] pt-3">
                    <div>
                      <p className="text-xs text-[#737A74]">
                        Amount
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {formatMoney(refund.amount)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[#737A74]">
                        Requested
                      </p>
                      <p className="mt-1 text-sm">
                        {formatDate(refund.requested_at)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 break-words text-sm text-[#737A74]">
                    <span className="font-medium text-[#333]">
                      Reason:{" "}
                    </span>
                    {refund.reason || "—"}
                  </p>

                  <div className="mt-3 flex flex-wrap justify-end gap-1 border-t border-[#E3E5DF] pt-3">
                    {renderActions(refund, true)}
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop refunds table */}
            <div className="hidden xl:block">
              <AdminTable
                headers={[
                  "Refund",
                  "Order",
                  "Customer",
                  "Amount",
                  "Reason",
                  "Status",
                  "Requested",
                  "Actions",
                ]}
              >
                {visibleRows.map((refund) => (
                  <tr key={refund.id}>
                    <td className="px-5 py-4 font-medium">
                      #{refund.id}
                    </td>

                    <td className="px-5 py-4">
                      #{refund.order_id}
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium">
                        {refund.customer_name || "Customer"}
                      </div>

                      <div className="mt-1 break-all text-xs text-[#737A74]">
                        {refund.customer_email || "—"}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {formatMoney(refund.amount)}
                    </td>

                    <td className="max-w-xs truncate px-5 py-4">
                      {refund.reason || "—"}
                    </td>

                    <td className="px-5 py-4">
                      <Badge>{refund.status}</Badge>
                    </td>

                    <td className="px-5 py-4">
                      {formatDate(refund.requested_at)}
                    </td>

                    <td className="px-5 py-4">
                      {renderActions(refund)}
                    </td>
                  </tr>
                ))}
              </AdminTable>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-[#E3E5DF] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#737A74] sm:text-sm">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(
                  currentPage * PAGE_SIZE,
                  filteredRows.length,
                )}{" "}
                of {filteredRows.length} refund requests
              </p>

              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <button
                  type="button"
                  disabled={currentPage <= 1 || loading}
                  onClick={() =>
                    setPage((current) => current - 1)
                  }
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#E3E5DF] px-3 text-sm disabled:opacity-40"
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
                    setPage((current) => current + 1)
                  }
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#E3E5DF] px-3 text-sm disabled:opacity-40"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <AdminEmpty>
            {search.trim()
              ? `No refunds match "${search.trim()}".`
              : filter
                ? "No refund requests for this filter."
                : "No refund requests found."}
          </AdminEmpty>
        )}
      </AdminPanel>

      <p className="mt-4 text-xs leading-5 text-[#737A74]">
        Declining a refund notifies the customer. Completing a refund
        requires a genuine{" "}
        {detail?.payment_method?.toLowerCase() === "cod"
          ? "manual bank/UPI transfer reference"
          : "gateway refund reference"}
        ; do not enter a placeholder.
      </p>

      {/* Refund details modal */}
      {detail && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-modal-title"
        >
          <section
            ref={modalRef}
            tabIndex={-1}
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 outline-none sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="refund-modal-title"
                className="text-xl font-semibold"
              >
                Refund #{detail.id}
              </h2>

              <button
                type="button"
                disabled={busy}
                onClick={closeDetail}
                className="shrink-0 rounded-lg px-2 py-1 text-sm text-[#486B57] hover:bg-[#F5F5F1] disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-[#737A74]">Order</dt>
                <dd>#{detail.order_id}</dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-[#737A74]">Amount</dt>
                <dd>{formatMoney(detail.amount)}</dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-[#737A74]">Payment</dt>
                <dd>
                  {detail.payment_id != null
                    ? `#${detail.payment_id}`
                    : "—"}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-[#737A74]">Payment method</dt>
                <dd className="text-right">
                  {formatPaymentMethod(detail.payment_method)}
                </dd>
              </div>

              <div>
                <dt className="text-[#737A74]">Gateway payment ID</dt>
                <dd className="mt-1 break-all font-mono text-xs">
                  {detail.gateway_payment_id || "Not available"}
                </dd>
              </div>

              <div className="flex justify-between gap-4">
                <dt className="text-[#737A74]">Status</dt>
                <dd>
                  <Badge>{detail.status}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-[#737A74]">Reason</dt>
                <dd className="mt-1 break-words">
                  {detail.reason || "—"}
                </dd>
              </div>
              {detail.decision_note && (
                <div>
                  <dt className="text-[#737A74]">
                    Admin decision note
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap break-words">
                    {detail.decision_note}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-[#737A74]">Selected items</dt>
                <dd className="mt-2">
                  {detail.refund_items?.length ? (
                    <ul className="space-y-2">
                      {detail.refund_items.map((item) => (
                        <li
                          key={item.id}
                          className="flex justify-between gap-4"
                        >
                          <span className="break-words">
                            {item.product_name} × {item.quantity}
                          </span>

                          <span className="shrink-0 font-medium">
                            {formatMoney(item.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-[#737A74]">
                      No item-level details recorded for this request.
                    </span>
                  )}
                </dd>
              </div>
              {detail.gateway_refund_id && (
                <div>
                  <dt className="text-[#737A74]">
                    Gateway refund ID
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs">
                    {detail.gateway_refund_id}
                  </dd>
                </div>
              )}
              {detail.manual_refund_reference && (
                <div>
                  <dt className="text-[#737A74]">
                    Manual transfer reference
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs">
                    {detail.manual_refund_reference}
                  </dd>
                </div>
              )}
            </dl>
            {detail.status === "approved" && (
              <form
                onSubmit={complete}
                className="mt-6 border-t border-[#E3E5DF] pt-5"
              >
                <label className="block text-sm font-medium">
                  {detail?.payment_method?.toLowerCase() === "cod"
                    ? "Manual bank/UPI transfer reference"
                    : "Gateway refund reference"}
                  <input
                    required
                    disabled={busy}
                    className="field mt-2 w-full"
                    value={gatewayId}
                    onChange={(event) =>
                      setGatewayId(event.target.value)
                    }
                    placeholder={
                      detail?.payment_method?.toLowerCase() === "cod"
                        ? "Enter actual bank/UPI transfer reference"
                        : "Enter actual Razorpay refund ID"
                    }
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || !gatewayId.trim()}
                  className="button-primary mt-4 w-full cursor-pointer disabled:opacity-50"
                >
                  {busy
                    ? "Updating…"
                    : "Record completed refund"}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export default AdminRefunds;