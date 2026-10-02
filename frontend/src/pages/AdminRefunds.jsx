import { useCallback, useEffect, useState } from "react";
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
function AdminRefunds() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("");
  const [detail, setDetail] = useState(null);
  const [gatewayId, setGatewayId] = useState("");
  const [busy, setBusy] = useState(false);
  const { notice, notify, clear } = useAdminNotice();
  const load = useCallback(
    () =>
      api
        .get(`/admin/refunds/${filter ? `?refund_status=${filter}` : ""}`)
        .then((r) => setRows(r.data))
        .catch((e) =>
          notify(
            e.response?.data?.detail || "Unable to load refunds.",
            "error",
          ),
        ),
    [filter, notify],
  );
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  const approve = async (r) => {
    if (!window.confirm(`Approve refund request #${r.id}?`)) return;
    try {
      await api.post(`/refunds/${r.id}/approve`);
      notify("Refund approved.");
      load();
    } catch (e) {
      notify(e.response?.data?.detail || "Unable to approve refund.", "error");
    }
  };
  const complete = async (e) => {
    e.preventDefault();
    if (!gatewayId.trim()) return;
    setBusy(true);
    try {
      await api.post(`/refunds/${detail.id}/complete`, null, {
        params: { gateway_refund_id: gatewayId.trim() },
      });
      notify("Refund marked completed.");
      setDetail(null);
      setGatewayId("");
      load();
    } catch (e) {
      notify(e.response?.data?.detail || "Unable to complete refund.", "error");
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
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All refund statuses</option>
            {["requested", "approved", "completed", "rejected"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        {rows.length ? (
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
                <td className="px-5 py-4">
                  ₹{Number(r.amount).toLocaleString("en-IN")}
                </td>
                <td className="max-w-xs truncate px-5 py-4">
                  {r.reason || "—"}
                </td>
                <td className="px-5 py-4">
                  <Badge>{r.status}</Badge>
                </td>
                <td className="px-5 py-4">
                  {new Date(r.requested_at).toLocaleDateString("en-IN")}
                </td>
                <td className="px-5 py-4">
                  <button
                    aria-label={`View refund ${r.id}`}
                    onClick={() => setDetail(r)}
                    className="rounded-lg p-2 hover:bg-[#DCE7DE]"
                  >
                    <Eye size={16} />
                  </button>
                  {r.status === "requested" && (
                    <button
                      className="ml-1 rounded-lg p-2 text-[#486B57] hover:bg-[#DCE7DE]"
                      aria-label={`Approve refund ${r.id}`}
                      onClick={() => approve(r)}
                    >
                      <Check size={16} />
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
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="flex justify-between">
              <h2 className="text-xl font-semibold">Refund #{detail.id}</h2>
              <button
                onClick={() => setDetail(null)}
                className="text-sm text-[#486B57] cursor-pointer"
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
                <dd>₹{Number(detail.amount).toLocaleString("en-IN")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#737A74]">Payment</dt>
                <dd>#{detail.payment_id}</dd>
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
                <button disabled={busy} className="button-primary mt-4 w-full">
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
