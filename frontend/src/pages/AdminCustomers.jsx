import { useCallback, useEffect, useState } from "react";
import { Eye } from "lucide-react";
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
function AdminCustomers() {
  const [rows, setRows] = useState([]);
  const [active, setActive] = useState("");
  const [detail, setDetail] = useState(null);
  const { notice, notify, clear } = useAdminNotice();
  const load = useCallback(
    () =>
      api
        .get(`/admin/customers/${active ? `?is_active=${active}` : ""}`)
        .then((r) => setRows(r.data))
        .catch((e) =>
          notify(
            e.response?.data?.detail || "Unable to load customers.",
            "error",
          ),
        ),
    [active, notify],
  );
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  const view = async (id) => {
    try {
      const r = await api.get(`/admin/customers/${id}`);
      setDetail(r.data);
    } catch (e) {
      notify(e.response?.data?.detail || "Unable to load customer.", "error");
    }
  };
  const toggle = async (c) => {
    try {
      await api.patch(`/admin/customers/${c.id}/status`, {
        is_active: !c.is_active,
      });
      notify(`Customer ${c.is_active ? "deactivated" : "activated"}.`);
      load();
      if (detail?.id === c.id)
        setDetail({ ...detail, is_active: !c.is_active });
    } catch (e) {
      notify(
        e.response?.data?.detail || "Unable to update customer status.",
        "error",
      );
    }
  };
  return (
    <>
      <AdminPageHeader
        title="Customers"
        description="Customer records and account access status."
      />
      <AdminNotice notice={notice} onClose={clear} />
      <AdminPanel>
        <div className="border-b border-[#E3E5DF] p-4">
          <select
            className="field max-w-56"
            aria-label="Filter customer accounts"
            value={active}
            onChange={(e) => setActive(e.target.value)}
          >
            <option value="">All customers</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        {rows.length ? (
          <AdminTable
            headers={[
              "Customer",
              "Email",
              "Phone",
              "Joined",
              "Status",
              "Actions",
            ]}
          >
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="px-5 py-4 font-medium">
                  {c.first_name} {c.last_name || ""}
                </td>
                <td className="px-5 py-4">{c.email}</td>
                <td className="px-5 py-4">{c.phone_number}</td>
                <td className="px-5 py-4">
                  {new Date(c.created_at).toLocaleDateString("en-IN")}
                </td>
                <td className="px-5 py-4">
                  <Badge>{c.is_active ? "active" : "inactive"}</Badge>
                </td>
                <td className="px-5 py-4">
                  <button
                    aria-label={`View ${c.first_name}`}
                    onClick={() => view(c.id)}
                    className="rounded-lg p-2 hover:bg-[#DCE7DE] cursor-pointer"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    className="ml-1 text-sm font-medium text-[#486B57] cursor-pointer "
                    onClick={() => toggle(c)}
                  >
                    {c.is_active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <AdminEmpty>No customers in this view.</AdminEmpty>
        )}
      </AdminPanel>
      {detail && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4">
          <section className="w-full max-w-md rounded-2xl bg-white p-6">
            <div className="flex justify-between">
              <h2 className="text-xl font-semibold">Customer</h2>
              <button
                className="text-sm text-[#486B57]"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
            </div>
            <p className="mt-5 font-medium">
              {detail.first_name} {detail.last_name || ""}
            </p>
            <p className="mt-1 text-sm text-[#737A74]">{detail.email}</p>
            <p className="mt-1 text-sm text-[#737A74]">{detail.phone_number}</p>
            <p className="mt-4 text-sm">
              Joined {new Date(detail.created_at).toLocaleDateString("en-IN")}
            </p>
            <div className="mt-4">
              <Badge>{detail.is_active ? "active" : "inactive"}</Badge>
            </div>
            <p className="mt-5 text-xs leading-5 text-[#737A74]">
              The customer detail API does not include order totals or address
              summaries.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
export default AdminCustomers;
