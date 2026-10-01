import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  Users,
  Warehouse,
} from "lucide-react";
import api from "../services/api";
import {
  AdminEmpty,
  AdminPageHeader,
  AdminPanel,
  AdminTable,
  Badge,
} from "../components/AdminUI";
const shortcuts = [
  [Boxes, "Products", "/admin/products"],
  [ClipboardList, "Orders", "/admin/orders"],
  [Users, "Customers", "/admin/customers"],
  [Warehouse, "Inventory", "/admin/inventory"],
];
function AdminDashboard() {
  const [data, setData] = useState({
    products: null,
    inventory: null,
    orders: null,
    customers: null,
    refunds: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api.get("/products/"),
      api.get("/admin/inventory/"),
      api.get("/admin/orders/?page=1&limit=8"),
      api.get("/admin/customers/"),
      api.get("/admin/refunds/?refund_status=requested"),
    ])
      .then((results) => {
        if (!alive) return;
        const vals = results.map((x) =>
          x.status === "fulfilled" ? x.value.data : null,
        );
        setData({
          products: vals[0],
          inventory: vals[1],
          orders: vals[2],
          customers: vals[3],
          refunds: vals[4],
        });
        if (
          results.some(
            (x) => x.status === "rejected" && x.reason.response?.status === 403,
          )
        )
          setError(
            "Admin access was denied. Sign in with an administrator account.",
          );
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);
  const lowStock =
    data.inventory?.filter((x) => x.available_quantity <= 5) || [];
  const stats = [
    ["Active products", data.products?.length, Boxes],
    ["Tracked inventory", data.inventory?.length, Warehouse],
    ["Orders", data.orders?.total, ClipboardList],
    ["Customers", data.customers?.length, Users],
  ];
  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="A clear view of current store operations."
      />
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-[#f8e8e3] p-4 text-sm text-[#8b4033]"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([title, value, Icon]) => (
          <AdminPanel key={title} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#737A74]">{title}</p>
              <Icon size={18} className="text-[#486B57]" />
            </div>
            <p className="mt-4 text-3xl font-semibold">
              {loading ? "—" : (value ?? "—")}
            </p>
          </AdminPanel>
        ))}
      </div>
      <div className="mt-7 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <AdminPanel>
          <div className="flex items-center justify-between border-b border-[#E3E5DF] px-5 py-4">
            <div>
              <h2 className="font-semibold">Recent orders</h2>
              <p className="mt-1 text-xs text-[#737A74]">
                Latest orders returned by the admin API
              </p>
            </div>
            <Link
              to="/admin/orders"
              className="text-sm font-medium text-[#486B57]"
            >
              All orders <ArrowRight className="ml-1 inline" size={14} />
            </Link>
          </div>
          {data.orders?.orders?.length ? (
            <AdminTable
              headers={["Order", "Customer", "Date", "Total", "Status"]}
            >
              {data.orders.orders.slice(0, 6).map((o) => (
                <tr key={o.id}>
                  <td className="px-5 py-4 font-medium">{o.order_number}</td>
                  <td className="px-5 py-4">
                    {o.user.first_name} {o.user.last_name || ""}
                  </td>
                  <td className="px-5 py-4 text-[#737A74]">
                    {new Date(o.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-5 py-4">
                    ₹{Number(o.total_amount).toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-4">
                    <Badge>{o.order_status}</Badge>
                  </td>
                </tr>
              ))}
            </AdminTable>
          ) : (
            <AdminEmpty>
              {loading ? "Loading orders…" : "No order data available."}
            </AdminEmpty>
          )}
        </AdminPanel>
        <div className="space-y-6">
          <AdminPanel>
            <div className="border-b border-[#E3E5DF] px-5 py-4">
              <h2 className="font-semibold">Needs attention</h2>
            </div>
            <div className="divide-y divide-[#E3E5DF]">
              <Link
                to="/admin/refunds"
                className="flex items-center justify-between p-5"
              >
                <span>
                  <span className="block text-sm font-medium">
                    Refund requests
                  </span>
                  <span className="mt-1 block text-xs text-[#737A74]">
                    Requested, awaiting review
                  </span>
                </span>
                <strong className="text-lg">
                  {data.refunds?.length ?? "—"}
                </strong>
              </Link>
              <Link
                to="/admin/inventory"
                className="flex items-center justify-between p-5"
              >
                <span>
                  <span className="block text-sm font-medium">
                    Low available stock
                  </span>
                  <span className="mt-1 block text-xs text-[#737A74]">
                    5 or fewer available units
                  </span>
                </span>
                <strong className="text-lg">
                  {data.inventory ? lowStock.length : "—"}
                </strong>
              </Link>
            </div>
          </AdminPanel>
          <AdminPanel className="p-5">
            <h2 className="font-semibold">Quick access</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {shortcuts.map(([Icon, label, to]) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-2 rounded-xl bg-[#F5F5F1] p-3 text-sm hover:bg-[#DCE7DE]"
                >
                  <Icon size={16} className="text-[#486B57]" />
                  {label}
                </Link>
              ))}
            </div>
          </AdminPanel>
          <p className="px-1 text-xs leading-5 text-[#737A74]">
            Payment totals and recent activity summaries aren’t exposed by a
            dedicated dashboard API.
          </p>
        </div>
      </div>
    </>
  );
}
export default AdminDashboard;
