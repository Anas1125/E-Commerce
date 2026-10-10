import { useEffect, useRef, useState } from "react";
import { Eye, Search, X } from "lucide-react";

import useAdminNotice from "../hooks/useAdminNotice";
import api from "../services/api";

import {
  AdminEmpty,
  AdminField,
  AdminNotice,
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  Badge,
} from "../components/AdminUI";

const statuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const paymentStatuses = ["pending", "paid", "failed", "refunded"];
const PAGE_SIZE = 20;

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

function formatDateTime(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN");
}

function formatMoney(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
}

function personName(user) {
  if (!user) return "—";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "—";
}

const label = (value) => String(value || "").replaceAll("_", " ");

function AdminOrders() {
  const [data, setData] = useState({
    orders: [],
    total: 0,
    page: 1,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [payment, setPayment] = useState("");
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const detailRef = useRef(null);

  const { notice, notify, clear } = useAdminNotice();

  // Only the search text is debounced; filters and paging fetch immediately
  useEffect(() => {
    const next = search.trim();
    if (next === debouncedSearch) return undefined;
    const timer = setTimeout(() => {
      setDebouncedSearch(next);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    const params = { page, limit: PAGE_SIZE };
    if (debouncedSearch) params.search = debouncedSearch;
    if (filter) params.order_status = filter;
    if (payment) params.payment_status = payment;

    api
      .get("/admin/orders/", { params })
      .then((response) => {
        if (cancelled) return;
        const next = response.data || {};
        const totalPages = Math.max(Number(next.total_pages) || 1, 1);
        setData({
          orders: Array.isArray(next.orders) ? next.orders : [],
          total: next.total ?? 0,
          page: next.page ?? page,
          total_pages: totalPages,
        });
        setLoadError("");
        // Page may be past the end after a filter change or status update
        if (page > totalPages) setPage(totalPages);
      })
      .catch((error) => {
        if (cancelled) return;
        const message = apiErrorMessage(error, "Unable to load orders.");
        setLoadError(message);
        notify(message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, debouncedSearch, filter, payment, reloadKey, notify]);

  useEffect(() => {
  if (!detail) return undefined;
    const previousActive = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !busy) {
        setDetail(null);
        return;
      }

      if (event.key !== "Tab") return;

      const dialog = detailRef.current;
      if (!dialog) return;

      const focusable = dialog.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]'
      );

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    requestAnimationFrame(() => {
      detailRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      requestAnimationFrame(() => previousActive?.focus?.());
    };
  }, [detail, busy]);

  const reload = () => setReloadKey((key) => key + 1);

  const retry = () => {
    setLoading(true);
    setLoadError("");
    reload();
  };

  const clearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  };

  const view = async (id) => {
    try {
      const response = await api.get(`/admin/orders/${id}`);
      setDetail(response.data);
      setStatus(response.data.order_status);
      setNote("");
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to load order."), "error");
    }
  };

  const update = async (event) => {
    event.preventDefault();
    if (busy || !detail) return;
    if (status === detail.order_status) {
      notify("Choose a different status to update.", "error");
      return;
    }
    if (
      status === "cancelled" &&
      !window.confirm(`Cancel order ${detail.order_number}?`)
    ) {
      return;
    }

    setBusy(true);
    try {
      const response = await api.patch(`/admin/orders/${detail.id}/status`, {
        status,
        note: note.trim() || null,
      });
      setDetail(response.data);
      setStatus(response.data.order_status);
      setNote("");
      notify("Order status updated.");
      reload();
    } catch (error) {
      notify(apiErrorMessage(error, "Unable to update order status."), "error");
    } finally {
      setBusy(false);
    }
  };

  const orders = data.orders;
  const detailItems = detail?.items ?? [];

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description={`${data.total} orders · search across orders, customers and items`}
      />

      <AdminNotice notice={notice} onClose={clear} />

      <AdminPanel>
        <div className="space-y-3 border-b border-[#E3E5DF] p-4">
          <div className="relative">
            <Search
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#737A74]"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Order ID, order number, customer, email or item; use phone: for phone"
              aria-label="Search orders"
              className="h-12 w-full rounded-xl border border-[#D9DDD8] bg-white pl-12 pr-12 text-sm text-[#212121] outline-none transition placeholder:text-[#8A8F8A] focus:border-[#486B57] focus:ring-4 focus:ring-[#486B57]/10"
            />

            {search && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear order search"
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-full p-1 text-[#737A74] transition hover:bg-[#E8ECE7] hover:text-[#2F513F]"
              >
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              aria-label="Filter order status"
              className="field max-w-56"
              value={filter}
              onChange={(event) => {
                setPage(1);
                setFilter(event.target.value);
              }}
            >
              <option value="">All order statuses</option>
              {statuses.map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {label(statusOption)}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter payment status"
              className="field max-w-52"
              value={payment}
              onChange={(event) => {
                setPage(1);
                setPayment(event.target.value);
              }}
            >
              <option value="">All payment statuses</option>
              {paymentStatuses.map((paymentStatus) => (
                <option key={paymentStatus} value={paymentStatus}>
                  {paymentStatus}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-sm text-[#737A74]">
            Loading orders…
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
        ) : orders.length ? (
          <AdminTable
            headers={[
              "Order ID",
              "Order number",
              "Customer",
              "Date",
              "Total",
              "Order status",
              "Payment",
              "View",
            ]}
          >
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-5 py-4 font-semibold">
                  #{order.id}
                </td>

                <td className="px-5 py-4 font-medium">
                  {order.order_number}
                </td>

                <td className="px-5 py-4">
                  {personName(order.user)}
                  <span className="block text-xs text-[#737A74]">
                    {order.user?.email || ""}
                  </span>
                </td>

                <td className="px-5 py-4">{formatDate(order.created_at)}</td>

                <td className="px-5 py-4">{formatMoney(order.total_amount)}</td>

                <td className="px-5 py-4">
                  <Badge>{order.order_status}</Badge>
                </td>

                <td className="px-5 py-4 capitalize">{order.payment_status}</td>

                <td className="px-5 py-4">
                  <button
                    type="button"
                    aria-label={`View order ${order.order_number}`}
                    onClick={() => view(order.id)}
                  className="cursor-pointer rounded-lg p-2 hover:bg-[#DCE7DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                  >
                    <Eye size={16} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>
            {debouncedSearch
              ? `No orders found for "${debouncedSearch}".`
              : "No orders match those filters."}
          </AdminEmpty>
        )}

        <div className="flex items-center justify-between border-t border-[#E3E5DF] px-5 py-3 text-sm">
          <span className="text-[#737A74]">
            Page {page} of {data.total_pages}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              className="button-secondary"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              Previous
            </button>

            <button
              type="button"
              className="button-secondary"
              disabled={page >= data.total_pages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </AdminPanel>

      {detail && (
        <div
          ref={detailRef}
          tabIndex={-1}
          className="fixed inset-0 z-[80] flex justify-end bg-black/35 outline-none"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-title"
        >
          <section className="h-full w-full max-w-2xl overflow-y-auto bg-[#F5F5F1] p-5 sm:p-8">
            <div className="flex justify-between">
              <div>
                <p className="eyebrow">Order detail</p>
                <h2
                  id="order-detail-title"
                  className="mt-1 text-2xl font-semibold"
                >
                  {detail.order_number}
                </h2>
              </div>

              <button
                type="button"
                disabled={busy}
                className="button-secondary h-fit cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <AdminPanel className="p-5">
                <p className="text-xs text-[#737A74]">Customer</p>
                <p className="mt-2 font-medium">{personName(detail.user)}</p>
                <p className="text-sm text-[#737A74]">
                  {detail.user?.email || "—"}
                </p>
                <p className="text-sm text-[#737A74]">
                  {detail.user?.phone_number || "—"}
                </p>
              </AdminPanel>

              <AdminPanel className="p-5">
                <p className="text-xs text-[#737A74]">
                  Delivery address snapshot
                </p>
                <p className="mt-2 text-sm leading-6">
                  {detail.shipping_address_line1}
                  {detail.shipping_address_line2 && (
                    <>, {detail.shipping_address_line2}</>
                  )}
                  <br />
                  {detail.shipping_city}, {detail.shipping_state}{" "}
                  {detail.shipping_postal_code}
                  <br />
                  {detail.shipping_country}
                </p>
              </AdminPanel>
            </div>

            <AdminPanel className="mt-4 p-5">
              <h3 className="font-semibold">Amounts & payment</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <span>Subtotal</span>
                <span>{formatMoney(detail.subtotal)}</span>

                <span>Discount</span>
                <span>{formatMoney(detail.discount_amount)}</span>

                <span>Shipping</span>
                <span>{formatMoney(detail.shipping_fee)}</span>

                <span>Total</span>
                <strong>{formatMoney(detail.total_amount)}</strong>

                <span>Payment status</span>
                <span className="capitalize">{detail.payment_status}</span>

                <span>Gateway</span>
                <span>{detail.payment?.payment_gateway || "—"}</span>
              </div>
            </AdminPanel>

            <AdminPanel className="mt-4 p-5">
              <h3 className="font-semibold">Items</h3>
              {detailItems.length ? (
                detailItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between border-b border-[#E3E5DF] py-3 text-sm"
                  >
                    <span>
                      {item.product_name} × {item.quantity}
                    </span>
                    <span>{formatMoney(item.final_price)}</span>
                  </div>
                ))
              ) : (
                <p className="mt-3 text-sm text-[#737A74]">
                  No items recorded.
                </p>
              )}
            </AdminPanel>

            <AdminPanel className="mt-4 p-5">
              <h3 className="font-semibold">Update fulfillment status</h3>

              <form className="mt-4 space-y-4" onSubmit={update}>
                <AdminField label="Status">
                  <select
                    className="field mt-2"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                  >
                    {statuses.map((statusOption) => (
                      <option
                        key={statusOption}
                        value={statusOption}
                        disabled={
                          statusOption === "pending" &&
                          detail.order_status !== "pending"
                        }
                      >
                        {label(statusOption)}
                      </option>
                    ))}
                  </select>
                </AdminField>

                <AdminField label="Note (optional)">
                  <textarea
                    className="field mt-2"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </AdminField>

                <button
                  type="submit"
                  disabled={busy || status === detail.order_status}
                  className="button-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                >
                  {busy ? "Updating…" : "Update status"}
                </button>
              </form>
            </AdminPanel>

            <AdminPanel className="mt-4 p-5">
              <h3 className="font-semibold">Status history</h3>

              {detail.status_history?.length ? (
                detail.status_history.map((history) => (
                  <p key={history.id} className="mt-3 text-sm">
                    <Badge>{history.status}</Badge>
                    <span className="ml-3 text-xs text-[#737A74]">
                      {formatDateTime(history.changed_at)}
                    </span>
                    {history.note && (
                      <span className="mt-1 block text-[#737A74]">
                        {history.note}
                      </span>
                    )}
                  </p>
                ))
              ) : (
                <p className="mt-3 text-sm text-[#737A74]">
                  No status updates recorded.
                </p>
              )}
            </AdminPanel>
          </section>
        </div>
      )}
    </>
  );
}

export default AdminOrders;