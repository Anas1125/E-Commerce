import { useCallback, useEffect, useState } from "react";
import { Eye } from "lucide-react";
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
  const [filter, setFilter] = useState("");
  const [payment, setPayment] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { notice, notify, clear } = useAdminNotice();
  const load = useCallback(() => {
    const q = new URLSearchParams({ page, limit: 20 });
    if (filter) q.set("order_status", filter);
    if (payment) q.set("payment_status", payment);
    api
      .get(`/admin/orders/?${q}`)
      .then((r) => setData(r.data))
      .catch((e) =>
        notify(e.response?.data?.detail || "Unable to load orders.", "error"),
      );
  }, [page, filter, payment, notify]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  const view = async (id) => {
    try {
      const r = await api.get(`/admin/orders/${id}`);
      setDetail(r.data);
      setStatus(r.data.order_status);
      setNote("");
    } catch (e) {
      notify(e.response?.data?.detail || "Unable to load order.", "error");
    }
  };
  const update = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.patch(`/admin/orders/${detail.id}/status`, {
        status,
        note: note || null,
      });
      setDetail(r.data);
      notify("Order status updated.");
      load();
    } catch (e) {
      notify(
        e.response?.data?.detail || "Unable to update order status.",
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
        description={`${data.total} orders · filter by fulfillment or payment state`}
      />
      <AdminNotice notice={notice} onClose={clear} />
      <AdminPanel>
        <div className="flex flex-wrap gap-3 border-b border-[#E3E5DF] p-4">
          <select
            aria-label="Filter order status"
            className="field max-w-56"
            value={filter}
            onChange={(e) => {
              setPage(1);
              setFilter(e.target.value);
            }}
          >
            <option value="">All order statuses</option>
            {statuses.map((x) => (
              <option key={x} value={x}>
                {x.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter payment status"
            className="field max-w-52"
            value={payment}
            onChange={(e) => {
              setPage(1);
              setPayment(e.target.value);
            }}
          >
            <option value="">All payment statuses</option>
            {["pending", "paid", "failed", "refunded"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
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
            {data.orders.map((o) => (
              <tr key={o.id}>
                <td className="px-5 py-4 font-medium">{o.order_number}</td>
                <td className="px-5 py-4">
                  {o.user.first_name} {o.user.last_name || ""}
                  <span className="block text-xs text-[#737A74]">
                    {o.user.email}
                  </span>
                </td>
                <td className="px-5 py-4">
                  {new Date(o.created_at).toLocaleDateString("en-IN")}
                </td>
                <td className="px-5 py-4">
                  ₹{Number(o.total_amount).toLocaleString("en-IN")}
                </td>
                <td className="px-5 py-4">
                  <Badge>{o.order_status}</Badge>
                </td>
                <td className="px-5 py-4 capitalize">{o.payment_status}</td>
                <td className="px-5 py-4">
                  <button
                    onClick={() => view(o.id)}
                    aria-label={`View order ${o.order_number}`}
                    className="rounded-lg p-2 hover:bg-[#DCE7DE]"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>No orders match those filters.</AdminEmpty>
        )}
        <div className="flex items-center justify-between border-t border-[#E3E5DF] px-5 py-3 text-sm">
          <span className="text-[#737A74]">
            Page {data.page} of {data.total_pages}
          </span>
          <div className="flex gap-2">
            <button
              className="button-secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              className="button-secondary"
              disabled={page >= data.total_pages}
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
                <p className="eyebrow">Order detail</p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {detail.order_number}
                </h2>
              </div>
              <button
                className="button-secondary h-fit"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <AdminPanel className="p-5">
                <p className="text-xs text-[#737A74]">Customer</p>
                <p className="mt-2 font-medium">
                  {detail.user.first_name} {detail.user.last_name || ""}
                </p>
                <p className="text-sm text-[#737A74]">{detail.user.email}</p>
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
                <span>₹{detail.subtotal}</span>
                <span>Discount</span>
                <span>₹{detail.discount_amount}</span>
                <span>Shipping</span>
                <span>₹{detail.shipping_fee}</span>
                <span>Total</span>
                <strong>₹{detail.total_amount}</strong>
                <span>Payment status</span>
                <span className="capitalize">{detail.payment_status}</span>
                <span>Gateway</span>
                <span>{detail.payment?.payment_gateway || "—"}</span>
              </div>
            </AdminPanel>
            <AdminPanel className="mt-4 p-5">
              <h3 className="font-semibold">Items</h3>
              {detail.items.map((i) => (
                <div
                  key={i.id}
                  className="flex justify-between border-b border-[#E3E5DF] py-3 text-sm"
                >
                  <span>
                    {i.product_name} × {i.quantity}
                  </span>
                  <span>₹{i.final_price}</span>
                </div>
              ))}
            </AdminPanel>
            <AdminPanel className="mt-4 p-5">
              <h3 className="font-semibold">Update fulfillment status</h3>
              <form className="mt-4 space-y-4" onSubmit={update}>
                <AdminField label="Status">
                  <select
                    className="field mt-2"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {statuses.slice(1).map((s) => (
                      <option key={s} value={s}>
                        {s.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </AdminField>
                <AdminField label="Note (optional)">
                  <textarea
                    className="field mt-2"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </AdminField>
                <button disabled={busy} className="button-primary">
                  {busy ? "Updating…" : "Update status"}
                </button>
              </form>
            </AdminPanel>
            <AdminPanel className="mt-4 p-5">
              <h3 className="font-semibold">Status history</h3>
              {detail.status_history?.length ? (
                detail.status_history.map((h) => (
                  <p key={h.id} className="mt-3 text-sm">
                    <Badge>{h.status}</Badge>
                    <span className="ml-3 text-xs text-[#737A74]">
                      {new Date(h.changed_at).toLocaleString("en-IN")}
                    </span>
                    {h.note && (
                      <span className="mt-1 block text-[#737A74]">
                        {h.note}
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
