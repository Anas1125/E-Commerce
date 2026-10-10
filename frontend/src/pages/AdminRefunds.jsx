import { useEffect, useRef, useState } from "react";
import { Check, Eye } from "lucide-react";
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

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function AdminRefunds() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState("");
  const [detail, setDetail] = useState(null);
  const [gatewayId, setGatewayId] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState(null);
  const modalRef = useRef(null);
  const triggerRef = useRef(null);
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
        const message = apiErrorMessage(error, "Unable to load refunds.");
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

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (!busy) {
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

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    requestAnimationFrame(() => {
      modalRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);

      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    };
  }, [detail, busy]);

  const reload = () => setReloadKey((key) => key + 1);

  const retry = () => {
    setLoading(true);
    setLoadError("");
    reload();
  };

  const changeFilter = (event) => {
    setLoading(true);
    setLoadError("");
    setFilter(event.target.value);
  };

  // Always reset the gateway reference so one refund's ID can never
  // end up recorded against a different refund.
  const openDetail = (refund) => {
    setGatewayId("");
    setDetail(refund);
  };

  const closeDetail = () => {
    if (busy) return;
    setDetail(null);
    setGatewayId("");
  };

  const approve = async (refund) => {
    if (pendingId) return;
    if (!window.confirm(`Approve refund request #${refund.id}?`)) return;

    setPendingId(refund.id);
    try {
      await api.post(`/refunds/${refund.id}/approve`);
      notify("Refund approved.");
      reload();
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to approve refund."), "error");
    } finally {
      setPendingId(null);
    }
  };

  const complete = async (event) => {
    event.preventDefault();
    if (busy || !detail) return;

    const reference = gatewayId.trim();
    if (!reference) return;

    if (
      !window.confirm(
        `Record refund #${detail.id} as completed with gateway reference "${reference}"? This cannot be undone here.`,
      )
    ) {
      return;
    }

    setBusy(true);
    try {
      await api.post(`/refunds/${detail.id}/complete`, null, {
        params: { gateway_refund_id: reference },
      });
      notify("Refund marked completed.");
      setDetail(null);
      setGatewayId("");
      reload();
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to complete refund."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Refunds"
        description="Review refund requests and record gateway completion."
      />
      <AdminNotice notice={notice} onClose={clear} />
      <AdminPanel>
        <div className="border-b border-[#E3E5DF] p-4">
          <select
            aria-label="Filter refund status"
            className="field max-w-56"
            value={filter}
            onChange={changeFilter}
          >
            <option value="">All refund statuses</option>
            {refundStatuses.map((x) => (
              <option key={x} value={x}>
                {x}
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
        ) : rows.length ? (
          <AdminTable
            headers={[
              "Refund",
              "Order",
              "Amount",
              "Reason",
              "Status",
              "Requested",
              "Actions",
            ]}
          >
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-4 font-medium">#{r.id}</td>
                <td className="px-5 py-4">#{r.order_id}</td>
                <td className="px-5 py-4">{formatMoney(r.amount)}</td>
                <td className="max-w-xs truncate px-5 py-4">
                  {r.reason || "—"}
                </td>
                <td className="px-5 py-4">
                  <Badge>{r.status}</Badge>
                </td>
                <td className="px-5 py-4">{formatDate(r.requested_at)}</td>
                <td className="px-5 py-4">
                  <button
                    type="button"
                    aria-label={`View refund ${r.id}`}
                    onClick={(event) => {
                      triggerRef.current = event.currentTarget;
                      openDetail(r);
                    }}
                    className="cursor-pointer rounded-lg p-2 hover:bg-[#DCE7DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                  >
                    <Eye size={16} aria-hidden="true" />
                  </button>
                  {r.status === "requested" && (
                    <button
                      type="button"
                      disabled={pendingId === r.id}
                      className="ml-1 cursor-pointer rounded-lg p-2 text-[#486B57] hover:bg-[#DCE7DE] disabled:opacity-50"
                      aria-label={`Approve refund ${r.id}`}
                      onClick={() => approve(r)}
                    >
                      <Check size={16} aria-hidden="true" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>No refund requests for this filter.</AdminEmpty>
        )}
      </AdminPanel>
      <p className="mt-4 text-xs text-[#737A74]">
        There is no reject endpoint. Completing a refund requires a genuine
        gateway refund reference; do not enter a placeholder.
      </p>
      {detail && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-modal-title"
        >
          <section
            ref={modalRef}
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl bg-white p-6"
          >
            <div className="flex justify-between">
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
                className="cursor-pointer text-sm text-[#486B57] disabled:opacity-50"
              >
                Close
              </button>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#737A74]">Order</dt>
                <dd>#{detail.order_id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#737A74]">Amount</dt>
                <dd>{formatMoney(detail.amount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#737A74]">Payment</dt>
                <dd>{detail.payment_id != null ? `#${detail.payment_id}` : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#737A74]">Status</dt>
                <dd>
                  <Badge>{detail.status}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-[#737A74]">Reason</dt>
                <dd className="mt-1">{detail.reason || "—"}</dd>
              </div>
              {detail.gateway_refund_id && (
                <div>
                  <dt className="text-[#737A74]">Gateway refund ID</dt>
                  <dd className="mt-1">{detail.gateway_refund_id}</dd>
                </div>
              )}
            </dl>
            {detail.status === "approved" && (
              <form
                onSubmit={complete}
                className="mt-6 border-t border-[#E3E5DF] pt-5"
              >
                <label className="block text-sm font-medium">
                  Gateway refund reference
                  <input
                    required
                    className="field mt-2"
                    value={gatewayId}
                    onChange={(e) => setGatewayId(e.target.value)}
                    placeholder="Actual provider refund ID"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busy || !gatewayId.trim()}
                  className="button-primary mt-4 w-full cursor-pointer"
                >
                  {busy ? "Updating…" : "Record completed refund"}
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