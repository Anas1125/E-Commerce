import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Circle,
  CreditCard,
  Package,
  ShieldCheck,
  Truck,
  MapPin, 
} from "lucide-react";

import api from "../services/api";
import useAuth from "../context/useAuth";

import {
  EmptyState,
  LoadingState,
  Price,
} from "../components/Storefront";

function OrderDetails() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();

  const [order, setOrder] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let alive = true;

    Promise.all([
      api.get(`/orders/${id}`),
      api.get(`/orders/${id}/history`),
    ])
      .then(([orderResponse, historyResponse]) => {
        if (!alive) return;

        setOrder(orderResponse.data);
        setHistory(historyResponse.data);
      })
      .catch((requestError) => {
        if (!alive) return;

        setError(
          requestError.response?.data?.detail ||
            "Unable to load this order.",
        );
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [id, isAuthenticated]);

  if (loading && isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <EmptyState
            title="Sign in to view this order"
            text="Order details are available from your account."
            action="Sign in"
            to="/login"
          />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <EmptyState
            title="Order unavailable"
            text={
              error ||
              "This order could not be found."
            }
            action="Back to orders"
            to="/orders"
          />
        </div>
      </div>
    );
  }

  const status = order.order_status.replaceAll(
    "_",
    " ",
  );

  return (
    <div className="min-h-screen bg-[#F1F3F6] pb-16">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* TOP */}
        <div className="mb-6">
          <Link
            to="/orders"
            className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#2874F0] hover:text-[#1f65d6]"
          >
            <ArrowLeft size={16} />
            Back to orders
          </Link>

          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2874F0]">
                Order details
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#212121]">
                {order.order_number}
              </h1>

              <p className="mt-1 text-sm text-[#878787]">
                Placed{" "}
                {new Date(
                  order.created_at,
                ).toLocaleString("en-IN")}
              </p>
            </div>

            <span className="inline-flex w-fit items-center rounded-full bg-[#E8F5E9] px-4 py-2 text-sm font-bold capitalize text-[#388E3C]">
              {status}
            </span>
          </div>
        </div>

        {/* ORDER STATUS BAR */}
        <section className="mb-5 rounded-md border border-[#E0E0E0] bg-white px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
              <Truck size={19} />
            </div>

            <div>
              <h2 className="font-bold capitalize text-[#212121]">
                {status}
              </h2>

              <p className="text-xs text-[#878787]">
                Latest order status
              </p>
            </div>
          </div>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">

          {/* LEFT */}
          <div className="space-y-5">

            {/* ITEMS */}
            <section className="rounded-md border border-[#E0E0E0] bg-white">
              <div className="border-b border-[#E0E0E0] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F7FA] text-[#2874F0]">
                    <Package size={18} />
                  </div>

                  <div>
                    <h2 className="font-bold text-[#212121]">
                      Items
                    </h2>

                    <p className="text-xs text-[#878787]">
                      Products included in this order
                    </p>
                  </div>
                </div>
              </div>

              <div className="divide-y divide-[#F0F0F0]">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between gap-5 px-5 py-5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#212121]">
                        {item.product_name}
                      </p>

                      <p className="mt-1 text-xs text-[#878787]">
                        Quantity {item.quantity} · Unit{" "}
                        <Price
                          value={item.unit_price}
                        />
                      </p>

                      {Number(
                        item.discount_amount,
                      ) > 0 && (
                        <p className="mt-2 text-xs font-semibold text-[#388E3C]">
                          Item discount{" "}
                          <Price
                            value={
                              item.discount_amount
                            }
                          />
                        </p>
                      )}
                    </div>

                    <Price
                      value={item.final_price}
                      className="shrink-0 text-sm font-bold text-[#212121]"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* ORDER PROGRESS */}
            <section className="rounded-md border border-[#E0E0E0] bg-white">
              <div className="border-b border-[#E0E0E0] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F7FA] text-[#2874F0]">
                    <Truck size={18} />
                  </div>

                  <div>
                    <h2 className="font-bold text-[#212121]">
                      Order Progress
                    </h2>

                    <p className="text-xs text-[#878787]">
                      Updates for this order
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                {history.length ? (
                  <ol className="space-y-6">
                    {history.map((item, index) => {
                      const isLatest =
                        index ===
                        history.length - 1;

                      return (
                        <li
                          key={item.id}
                          className="relative flex gap-4"
                        >
                          {!isLatest && (
                            <span className="absolute left-[7px] top-5 h-full w-px bg-[#E0E0E0]" />
                          )}

                          <span
                            className={`relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                              isLatest
                                ? "bg-[#2874F0]"
                                : "bg-[#DCE7DE]"
                            }`}
                          >
                            {isLatest ? (
                              <Check
                                size={10}
                                className="text-white"
                              />
                            ) : (
                              <Circle
                                size={7}
                                className="fill-[#388E3C] text-[#388E3C]"
                              />
                            )}
                          </span>

                          <div className="min-w-0">
                            <p className="text-sm font-bold capitalize text-[#212121]">
                              {item.status.replaceAll(
                                "_",
                                " ",
                              )}
                            </p>

                            <p className="mt-1 text-xs text-[#878787]">
                              {new Date(
                                item.changed_at,
                              ).toLocaleString(
                                "en-IN",
                              )}
                            </p>

                            {item.note && (
                              <p className="mt-2 text-sm leading-5 text-[#666]">
                                {item.note}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="text-sm text-[#878787]">
                    No status updates yet.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT */}
          <aside className="space-y-5 lg:sticky lg:top-5">

            {/* PAYMENT */}
            <section className="rounded-md border border-[#E0E0E0] bg-white">
              <div className="border-b border-[#E0E0E0] px-5 py-4">
                <div className="flex items-center gap-3">
                  <CreditCard
                    size={19}
                    className="text-[#2874F0]"
                  />

                  <h2 className="font-bold text-[#212121]">
                    Payment
                  </h2>
                </div>
              </div>

              <div className="p-5">
                <div className="flex justify-between text-sm">
                  <span className="text-[#878787]">
                    Status
                  </span>

                  <span className="font-semibold capitalize text-[#212121]">
                    {order.payment_status}
                  </span>
                </div>
              </div>
            </section>

            {/* DELIVERY */}
            <section className="rounded-md border border-[#E0E0E0] bg-white">
              <div className="border-b border-[#E0E0E0] px-5 py-4">
                <h2 className="font-bold text-[#212121]">
                  Delivery Address
                </h2>
              </div>

              <div className="p-5">
                <div className="flex gap-3">
                  <MapPinIcon />

                  <p className="text-sm leading-6 text-[#878787]">
                    The delivery address snapshot is stored
                    with this order. The current customer
                    response does not expose its individual
                    address fields.
                  </p>
                </div>
              </div>
            </section>

            {/* SUMMARY */}
            <section className="overflow-hidden rounded-md border border-[#E0E0E0] bg-white">
              <div className="border-b border-[#E0E0E0] px-5 py-4">
                <h2 className="font-bold text-[#212121]">
                  Price Details
                </h2>
              </div>

              <div className="p-5">
                <div className="space-y-4 text-sm">

                  <div className="flex justify-between">
                    <span className="text-[#555]">
                      Subtotal
                    </span>

                    <Price value={order.subtotal} />
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[#555]">
                      Discount
                    </span>

                    <span className="font-semibold text-[#388E3C]">
                      -{" "}
                      <Price
                        value={
                          order.discount_amount
                        }
                      />
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-[#555]">
                      Shipping
                    </span>

                    <Price
                      value={order.shipping_fee}
                    />
                  </div>
                </div>

                <div className="my-5 border-t border-dashed border-[#D0D0D0]" />

                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-[#212121]">
                    Total
                  </span>

                  <Price
                    value={order.total_amount}
                    className="text-xl font-bold text-[#212121]"
                  />
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#878787]">
                  <ShieldCheck size={15} />
                  Secure order information
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MapPinIcon() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
      <MapPin size={17} />
    </div>
  );
}

export default OrderDetails;