import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";
import useAuth from "../context/useAuth";
import { EmptyState, LoadingState, Price } from "../components/Storefront";
function OrderDetails() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const [order, setOrder] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    Promise.all([api.get(`/orders/${id}`), api.get(`/orders/${id}/history`)])
      .then(([o, h]) => {
        if (!alive) return;
        setOrder(o.data);
        setHistory(h.data);
      })
      .catch(
        (e) =>
          alive &&
          setError(e.response?.data?.detail || "Unable to load this order."),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, isAuthenticated]);
  if (loading)
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <LoadingState />
      </div>
    );
  if (!isAuthenticated)
    return (
      <div className="mx-auto max-w-4xl px-6 py-20">
        <EmptyState
          title="Sign in to view this order"
          text="Order details are available from your account."
          action="Sign in"
          to="/login"
        />
      </div>
    );
  if (error || !order)
    return (
      <div className="mx-auto max-w-4xl px-6 py-20">
        <EmptyState
          title="Order unavailable"
          text={error || "This order could not be found."}
          action="Back to orders"
          to="/orders"
        />
      </div>
    );
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-7 text-xs text-[#737A74]">
        <Link to="/orders">Orders</Link>
        <span className="mx-2">/</span>
        {order.order_number}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Order details</p>
          <h1 className="mt-2 text-3xl font-semibold">{order.order_number}</h1>
          <p className="mt-2 text-sm text-[#737A74]">
            Placed {new Date(order.created_at).toLocaleString("en-IN")}
          </p>
        </div>
        <span className="rounded-full bg-[#DCE7DE] px-4 py-2 text-sm font-medium capitalize text-[#486B57]">
          {order.order_status.replaceAll("_", " ")}
        </span>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="space-y-6">
          <div className="rounded-2xl border border-[#E3E5DF] bg-white p-6">
            <h2 className="font-semibold">Items</h2>
            <div className="mt-4 divide-y divide-[#E3E5DF]">
              {order.items.map((i) => (
                <div
                  key={i.id}
                  className="flex justify-between gap-4 py-4 text-sm"
                >
                  <div>
                    <p className="font-medium">{i.product_name}</p>
                    <p className="mt-1 text-[#737A74]">
                      Quantity {i.quantity} · Unit{" "}
                      <Price value={i.unit_price} />
                    </p>
                    {Number(i.discount_amount) > 0 && (
                      <p className="mt-1 text-xs text-[#486B57]">
                        Item discount <Price value={i.discount_amount} />
                      </p>
                    )}
                  </div>
                  <Price value={i.final_price} className="font-medium" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#E3E5DF] bg-white p-6">
            <h2 className="font-semibold">Order progress</h2>
            {history.length ? (
              <ol className="mt-5 space-y-4">
                {history.map((h, i) => (
                  <li key={h.id} className="relative flex gap-4">
                    <span
                      className={`mt-1 h-3 w-3 shrink-0 rounded-full ${i === history.length - 1 ? "bg-[#486B57]" : "bg-[#cdd8ce]"}`}
                    />
                    <div>
                      <p className="text-sm font-medium capitalize">
                        {h.status.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-xs text-[#737A74]">
                        {new Date(h.changed_at).toLocaleString("en-IN")}
                      </p>
                      {h.note && (
                        <p className="mt-1 text-sm text-[#737A74]">{h.note}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-sm text-[#737A74]">
                No status updates yet.
              </p>
            )}
          </div>
        </section>
        <aside className="space-y-5">
          <div className="rounded-2xl border border-[#E3E5DF] bg-white p-6">
            <h2 className="font-semibold">Payment</h2>
            <p className="mt-4 text-sm">
              Status{" "}
              <span className="float-right capitalize">
                {order.payment_status}
              </span>
            </p>
          </div>
          <div className="rounded-2xl border border-[#E3E5DF] bg-white p-6">
            <h2 className="font-semibold">Delivery address</h2>
            <p className="mt-3 text-sm leading-6 text-[#737A74]">
              The delivery snapshot is stored with your order, but the current
              customer response does not include its fields.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E3E5DF] bg-white p-6">
            <h2 className="font-semibold">Summary</h2>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex justify-between">
                <span className="text-[#737A74]">Subtotal</span>
                <Price value={order.subtotal} />
              </p>
              <p className="flex justify-between">
                <span className="text-[#737A74]">Discount</span>
                <Price value={order.discount_amount} />
              </p>
              <p className="flex justify-between">
                <span className="text-[#737A74]">Shipping</span>
                <Price value={order.shipping_fee} />
              </p>
              <p className="flex justify-between border-t border-[#E3E5DF] pt-4 text-base font-semibold">
                <span>Total</span>
                <Price value={order.total_amount} />
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
export default OrderDetails;
