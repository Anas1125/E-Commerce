import { useCallback, useEffect, useState } from "react";
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

function AdminOrders() {
  const [data, setData] = useState({
    orders: [],
    total: 0,
    page: 1,
    total_pages: 1,
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [payment, setPayment] = useState("");
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { notice, notify, clear } = useAdminNotice();

  const load = useCallback(() => {
    const q = new URLSearchParams({
      page,
      limit: 20,
    });

    const trimmedSearch = search.trim();

    if (trimmedSearch) {
      q.set("search", trimmedSearch);
    }

    if (filter) {
      q.set("order_status", filter);
    }

    if (payment) {
      q.set("payment_status", payment);
    }

    api
      .get(`/admin/orders/?${q}`)
      .then((response) => {
        setData(response.data);
      })
      .catch((error) => {
        notify(
          error.response?.data?.detail ||
            "Unable to load orders.",
          "error",
        );
      });
  }, [page, search, filter, payment, notify]);

  useEffect(() => {
    const timer = setTimeout(load, 350);

    return () => clearTimeout(timer);
  }, [load]);

  const clearSearch = () => {
    setSearch("");
    setPage(1);
  };

  const view = async (id) => {
    try {
      const response = await api.get(
        `/admin/orders/${id}`,
      );

      setDetail(response.data);
      setStatus(response.data.order_status);
      setNote("");
    } catch (error) {
      notify(
        error.response?.data?.detail ||
          "Unable to load order.",
        "error",
      );
    }
  };

  const update = async (event) => {
    event.preventDefault();

    setBusy(true);

    try {
      const response = await api.patch(
        `/admin/orders/${detail.id}/status`,
        {
          status,
          note: note || null,
        },
      );

      setDetail(response.data);
      notify("Order status updated.");
      load();
    } catch (error) {
      notify(
        error.response?.data?.detail ||
          "Unable to update order status.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description={`${data.total} orders · search across orders, customers and items`}
      />

      <AdminNotice
        notice={notice}
        onClose={clear}
      />

      <AdminPanel>
        <div className="space-y-3 border-b border-[#E3E5DF] p-4">
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#737A74]"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Search order number, customer, email, phone or item..."
              aria-label="Search orders"
              className="h-12 w-full rounded-xl border border-[#D9DDD8] bg-white pl-12 pr-12 text-sm text-[#212121] outline-none transition placeholder:text-[#8A8F8A] focus:border-[#486B57] focus:ring-4 focus:ring-[#486B57]/10"
            />

            {search && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear order search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#737A74] transition hover:bg-[#E8ECE7] hover:text-[#2F513F] cursor-pointer"
              >
                <X size={16} />
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
              <option value="">
                All order statuses
              </option>

              {statuses.map((statusOption) => (
                <option
                  key={statusOption}
                  value={statusOption}
                >
                  {statusOption.replaceAll("_", " ")}
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
              <option value="">
                All payment statuses
              </option>

              {[
                "pending",
                "paid",
                "failed",
                "refunded",
              ].map((paymentStatus) => (
                <option
                  key={paymentStatus}
                  value={paymentStatus}
                >
                  {paymentStatus}
                </option>
              ))}
            </select>
          </div>
        </div>

        {data.orders.length ? (
          <AdminTable
            headers={[
              "Order",
              "Customer",
              "Date",
              "Total",
              "Order status",
              "Payment",
              "View",
            ]}
          >
            {data.orders.map((order) => (
              <tr key={order.id}>
                <td className="px-5 py-4 font-medium">
                  {order.order_number}
                </td>

                <td className="px-5 py-4">
                  {order.user.first_name}{" "}
                  {order.user.last_name || ""}

                  <span className="block text-xs text-[#737A74]">
                    {order.user.email}
                  </span>
                </td>

                <td className="px-5 py-4">
                  {new Date(
                    order.created_at,
                  ).toLocaleDateString("en-IN")}
                </td>

                <td className="px-5 py-4">
                  ₹
                  {Number(
                    order.total_amount,
                  ).toLocaleString("en-IN")}
                </td>

                <td className="px-5 py-4">
                  <Badge>
                    {order.order_status}
                  </Badge>
                </td>

                <td className="px-5 py-4 capitalize">
                  {order.payment_status}
                </td>

                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => view(order.id)}
                    aria-label={`View order ${order.order_number}`}
                    className="cursor-pointer rounded-lg p-2 hover:bg-[#DCE7DE]"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>
            {search.trim()
              ? `No orders found for "${search.trim()}".`
              : "No orders match those filters."}
          </AdminEmpty>
        )}

        <div className="flex items-center justify-between border-t border-[#E3E5DF] px-5 py-3 text-sm">
          <span className="text-[#737A74]">
            Page {data.page} of {data.total_pages}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              className="button-secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>

            <button
              type="button"
              className="button-secondary"
              disabled={
                page >= data.total_pages
              }
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </AdminPanel>

      {detail && (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/35">
          <section className="h-full w-full max-w-2xl overflow-y-auto bg-[#F5F5F1] p-5 sm:p-8">
            <div className="flex justify-between">
              <div>
                <p className="eyebrow">
                  Order detail
                </p>

                <h2 className="mt-1 text-2xl font-semibold">
                  {detail.order_number}
                </h2>
              </div>

              <button
                type="button"
                className="button-secondary h-fit cursor-pointer"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <AdminPanel className="p-5">
                <p className="text-xs text-[#737A74]">
                  Customer
                </p>

                <p className="mt-2 font-medium">
                  {detail.user.first_name}{" "}
                  {detail.user.last_name || ""}
                </p>

                <p className="text-sm text-[#737A74]">
                  {detail.user.email}
                </p>

                <p className="text-sm text-[#737A74]">
                  {detail.user.phone_number}
                </p>
              </AdminPanel>

              <AdminPanel className="p-5">
                <p className="text-xs text-[#737A74]">
                  Delivery address snapshot
                </p>

                <p className="mt-2 text-sm leading-6">
                  {detail.shipping_address_line1}

                  {detail.shipping_address_line2 && (
                    <>
                      , {detail.shipping_address_line2}
                    </>
                  )}

                  <br />

                  {detail.shipping_city},{" "}
                  {detail.shipping_state}{" "}
                  {detail.shipping_postal_code}

                  <br />

                  {detail.shipping_country}
                </p>
              </AdminPanel>
            </div>

            <AdminPanel className="mt-4 p-5">
              <h3 className="font-semibold">
                Amounts & payment
              </h3>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <span>Subtotal</span>
                <span>₹{detail.subtotal}</span>

                <span>Discount</span>
                <span>
                  ₹{detail.discount_amount}
                </span>

                <span>Shipping</span>
                <span>
                  ₹{detail.shipping_fee}
                </span>

                <span>Total</span>
                <strong>
                  ₹{detail.total_amount}
                </strong>

                <span>Payment status</span>
                <span className="capitalize">
                  {detail.payment_status}
                </span>

                <span>Gateway</span>
                <span>
                  {detail.payment
                    ?.payment_gateway || "—"}
                </span>
              </div>
            </AdminPanel>

            <AdminPanel className="mt-4 p-5">
              <h3 className="font-semibold">
                Items
              </h3>

              {detail.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between border-b border-[#E3E5DF] py-3 text-sm"
                >
                  <span>
                    {item.product_name} ×{" "}
                    {item.quantity}
                  </span>

                  <span>
                    ₹{item.final_price}
                  </span>
                </div>
              ))}
            </AdminPanel>

            <AdminPanel className="mt-4 p-5">
              <h3 className="font-semibold">
                Update fulfillment status
              </h3>

              <form
                className="mt-4 space-y-4"
                onSubmit={update}
              >
                <AdminField label="Status">
                  <select
                    className="field mt-2"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value)
                    }
                  >
                    {statuses.slice(1).map(
                      (statusOption) => (
                        <option
                          key={statusOption}
                          value={statusOption}
                        >
                          {statusOption.replaceAll(
                            "_",
                            " ",
                          )}
                        </option>
                      ),
                    )}
                  </select>
                </AdminField>

                <AdminField label="Note (optional)">
                  <textarea
                    className="field mt-2"
                    value={note}
                    onChange={(event) =>
                      setNote(event.target.value)
                    }
                  />
                </AdminField>

                <button
                  type="submit"
                  disabled={busy}
                  className="button-primary cursor-pointer"
                >
                  {busy
                    ? "Updating…"
                    : "Update status"}
                </button>
              </form>
            </AdminPanel>

            <AdminPanel className="mt-4 p-5">
              <h3 className="font-semibold">
                Status history
              </h3>

              {detail.status_history?.length ? (
                detail.status_history.map(
                  (history) => (
                    <p
                      key={history.id}
                      className="mt-3 text-sm"
                    >
                      <Badge>
                        {history.status}
                      </Badge>

                      <span className="ml-3 text-xs text-[#737A74]">
                        {new Date(
                          history.changed_at,
                        ).toLocaleString("en-IN")}
                      </span>

                      {history.note && (
                        <span className="mt-1 block text-[#737A74]">
                          {history.note}
                        </span>
                      )}
                    </p>
                  ),
                )
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