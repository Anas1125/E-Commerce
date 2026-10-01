import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import useAuth from "../context/useAuth";
import {
  EmptyState,
  LoadingState,
  PageIntro,
  Price,
} from "../components/Storefront";
function Orders() {
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isAuthenticated) return;
    const timer = setTimeout(() => {
      api
        .get("/orders/")
        .then((r) => setOrders(r.data))
        .catch((e) =>
          setError(e.response?.data?.detail || "Unable to load orders."),
        )
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [isAuthenticated]);
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <PageIntro
        eyebrow="Your purchases"
        title="Orders"
        description="Order status and payment updates in one place."
      />
      {loading ? (
        <LoadingState />
      ) : !isAuthenticated ? (
        <EmptyState
          title="Sign in to view your orders"
          text="Your order history is private to your account."
          action="Sign in"
          to="/login"
        />
      ) : error ? (
        <EmptyState title="Orders unavailable" text={error} />
      ) : orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          text="Once you place an order, it will appear here."
          action="Explore the shop"
        />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <article
              key={o.id}
              className="rounded-2xl border border-[#E3E5DF] bg-white p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-[#737A74]">
                    {new Date(o.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <h2 className="mt-1 font-semibold">{o.order_number}</h2>
                </div>
                <span className="rounded-full bg-[#DCE7DE] px-3 py-1 text-xs font-medium capitalize text-[#486B57]">
                  {o.order_status.replaceAll("_", " ")}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E3E5DF] pt-4">
                <p className="text-sm text-[#737A74]">
                  Payment{" "}
                  <span className="ml-1 capitalize text-[#1F2521]">
                    {o.payment_status}
                  </span>{" "}
                  · {o.items?.length || 0} items
                </p>
                <div className="flex items-center gap-4">
                  <Price value={o.total_amount} className="font-semibold" />
                  <Link
                    className="text-sm font-semibold text-[#486B57]"
                    to={`/orders/${o.id}`}
                  >
                    View order →
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
export default Orders;
