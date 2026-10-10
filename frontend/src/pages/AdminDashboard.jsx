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

const LOW_STOCK_THRESHOLD = 5;
const RECENT_ORDER_LIMIT = 6;

const SECTIONS = [
  ["products", "products", () => api.get("/products/")],
  ["inventory", "inventory", () => api.get("/admin/inventory/")],
  [
    "orders",
    "orders",
    () =>
      api.get("/admin/orders/", {
        params: { page: 1, limit: RECENT_ORDER_LIMIT },
      }),
  ],
  ["customers", "customers", () => api.get("/admin/customers/")],
  [
    "refunds",
    "refunds",
    () => api.get("/admin/refunds/", { params: { refund_status: "requested" } }),
  ],
];

function formatDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN");
}

function customerName(user) {
  if (!user) return "—";
  return `${user.first_name || ""} ${user.last_name || ""}`.trim() || "—";
}

const emptyData = {
  products: null,
  inventory: null,
  orders: null,
  customers: null,
  refunds: null,
};

function AdminDashboard() {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    Promise.allSettled(SECTIONS.map(([, , request]) => request()))
      .then((results) => {
        if (!alive) return;

        const next = { ...emptyData };
        const failedLabels = [];
        let denied = false;

        results.forEach((result, index) => {
          const [key, label] = SECTIONS[index];
          if (result.status === "fulfilled") {
            next[key] = result.value.data;
          } else {
            failedLabels.push(label);
            if (result.reason?.response?.status === 403) denied = true;
          }
        });

        setData(next);
        setFailed(failedLabels);
        setError(
          denied
            ? "Admin access was denied. Sign in with an administrator account."
            : "",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const retry = () => {
    setLoading(true);
    setError("");
    setFailed([]);
    setReloadKey((key) => key + 1);
  };

  const lowStock = Array.isArray(data.inventory)
    ? data.inventory.filter(
        (item) =>
          Number.isFinite(Number(item.available_quantity)) &&
          item.available_quantity !== null &&
          Number(item.available_quantity) <= LOW_STOCK_THRESHOLD,
      )
    : [];

  const stats = [
    ["Active products", data.products?.length, Boxes],
    ["Tracked inventory", data.inventory?.length, Warehouse],
    ["Orders", data.orders?.total, ClipboardList],
    ["Customers", data.customers?.length, Users],
  ];

  const recentOrders = data.orders?.orders?.slice(0, RECENT_ORDER_LIMIT) || [];

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="A clear view of current store operations."
      />
      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-[#f8e8e3] p-4 text-sm text-[#8b4033]"
        >
          {error}
        </p>
      ) : (
        !loading &&
        failed.length > 0 && (
          <div
            role="alert"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f8e8e3] p-4 text-sm text-[#8b4033]"
          >
            <span>Couldn’t load: {failed.join(", ")}.</span>
            <button
              type="button"
              onClick={retry}
              className="button-secondary cursor-pointer"
            >
              Retry
            </button>
          </div>
        )
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([title, value, Icon]) => (
          <AdminPanel key={title} className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#737A74]">{title}</p>
              <Icon size={18} className="text-[#486B57]" aria-hidden="true" />
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
              className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57] text-sm font-medium text-[#486B57]"
            >
              All orders{" "}
              <ArrowRight className="ml-1 inline" size={14} aria-hidden="true" />
            </Link>
          </div>
          {recentOrders.length ? (
            <AdminTable
              headers={["Order", "Customer", "Date", "Total", "Status"]}
            >
              {recentOrders.map((o) => (
                <tr key={o.id}>
                  <td className="px-5 py-4 font-medium">{o.order_number}</td>
                  <td className="px-5 py-4">{customerName(o.user)}</td>
                  <td className="px-5 py-4 text-[#737A74]">
                    {formatDate(o.created_at)}
                  </td>
                  <td className="px-5 py-4">
                    ₹{Number(o.total_amount || 0).toLocaleString("en-IN")}
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
                className="flex items-center justify-between rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57] p-5"
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
                className="flex items-center justify-between rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57] p-5"
              >
                <span>
                  <span className="block text-sm font-medium">
                    Low available stock
                  </span>
                  <span className="mt-1 block text-xs text-[#737A74]">
                    {LOW_STOCK_THRESHOLD} or fewer available units
                  </span>
                </span>
                <strong className="text-lg">
                  {Array.isArray(data.inventory) ? lowStock.length : "—"}
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
                  className="flex items-center gap-2 rounded-xl bg-[#F5F5F1] p-3 text-sm hover:bg-[#DCE7DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]"
                >
                  <Icon
                    size={16}
                    className="text-[#486B57]"
                    aria-hidden="true"
                  />
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