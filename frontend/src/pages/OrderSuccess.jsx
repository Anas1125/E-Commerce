import {
  Check,
  Package,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { useContext } from "react";
import { Link, useLocation } from "react-router-dom";

import { Price } from "../components/Storefront";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

function OrderSuccess() {
  const { state } = useLocation();
  const order = state?.order;
  const { siteName = "TerraLens" } = useContext(
    SiteBrandingContext,
  );

  const isCod = order?.payment_method === "cod";

  return (
  <>
    <SEO
      title="Order Confirmation"
      description={`View your ${siteName} order confirmation and payment details.`}
      noIndex
    />

    <div className="min-h-screen bg-[#F1F3F6] px-4 py-12 sm:px-6">
      <div className="mx-auto flex min-h-[75vh] max-w-4xl items-center justify-center">

        <div className="w-full overflow-hidden rounded-md border border-[#E0E0E0] bg-white shadow-sm">

          {/* SUCCESS HEADER */}
          <div className="border-b border-[#E0E0E0] px-6 py-10 text-center sm:px-10">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#E8F5E9] text-[#388E3C]">
              <Check size={30} strokeWidth={2.5} />
            </div>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#388E3C]">
              {isCod
                ? "Cash on Delivery"
                : "Order status"}
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#212121]">
              {isCod
                ? "Your order is confirmed!"
                : "Order details"}
            </h1>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#878787]">
              {isCod
                ? "We've received your order. Payment is due when your order is delivered."
                : "No online payment is reported as successful here."}
            </p>
          </div>

          {order ? (
            <>
              {/* ORDER INFO */}
              <div className="px-6 py-6 sm:px-10">

                <div className="grid gap-4 sm:grid-cols-3">

                  {/* ORDER NUMBER */}
                  <div className="rounded-md bg-[#F7F8FA] p-4">
                    <div className="flex items-center gap-2">
                      <Package
                        size={17}
                        className="text-[#2874F0]"
                      />

                      <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                        Order number
                      </p>
                    </div>

                    <p className="mt-2 text-sm font-bold text-[#212121]">
                      {order.order_number}
                    </p>
                  </div>

                  {/* TOTAL */}
                  <div className="rounded-md bg-[#F7F8FA] p-4">
                    <div className="flex items-center gap-2">
                      <ShoppingBag
                        size={17}
                        className="text-[#2874F0]"
                      />

                      <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                        Total
                      </p>
                    </div>

                    <Price
                      value={order.total_amount}
                      className="mt-2 text-sm font-bold text-[#212121]"
                    />
                  </div>

                  {/* STATUS */}
                  <div className="rounded-md bg-[#F7F8FA] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                      Order status
                    </p>

                    <p className="mt-2 text-sm font-bold capitalize text-[#388E3C]">
                      {order.order_status.replaceAll(
                        "_",
                        " ",
                      )}
                    </p>
                  </div>
                </div>

                {/* PAYMENT DETAILS */}
                <div className="mt-5 rounded-md border border-[#E0E0E0]">
                  <div className="border-b border-[#E0E0E0] px-5 py-4">
                    <h2 className="font-bold text-[#212121]">
                      Payment Details
                    </h2>
                  </div>

                  <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                        Payment method
                      </p>

                      <p className="mt-2 text-sm font-semibold capitalize text-[#212121]">
                        {order.payment_method ||
                          "Unknown"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                        Payment status
                      </p>

                      <p className="mt-2 text-sm font-semibold capitalize text-[#212121]">
                        {order.payment_status}
                      </p>
                    </div>
                  </div>
                </div>

                {/* COD MESSAGE */}
                {isCod && (
                  <div className="mt-5 rounded-md border border-[#C8E6C9] bg-[#F1F8F2] p-4">
                    <div className="flex gap-3">
                      <ShieldCheck
                        size={20}
                        className="mt-0.5 shrink-0 text-[#388E3C]"
                      />

                      <div>
                        <p className="text-sm font-bold text-[#2E7D32]">
                          Cash on Delivery
                        </p>

                        <p className="mt-1 text-xs leading-5 text-[#555]">
                          Please keep the order total ready
                          when your delivery arrives.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ACTIONS */}
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">

                  <Link
                    to={`/orders/${order.id}`}
                    className="inline-flex cursor-pointer items-center justify-center rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
                  >
                    View order
                  </Link>

                  <Link
                    to="/shop"
                    className="inline-flex cursor-pointer items-center justify-center rounded-md border border-[#D0D0D0] bg-white px-7 py-3 text-sm font-bold text-[#212121] transition hover:border-[#2874F0] hover:bg-[#F5F9FF] hover:text-[#2874F0]"
                  >
                    Continue shopping
                  </Link>
                </div>
              </div>

              {/* FOOTER */}
              <div className="border-t border-[#E0E0E0] bg-[#FAFAFA] px-6 py-4 text-center sm:px-10">
                <div className="flex items-center justify-center gap-2 text-xs text-[#878787]">
                  <ShieldCheck size={15} />
                  Your order has been securely recorded.
                </div>
              </div>
            </>
          ) : (
            /* NO ORDER STATE */
            <div className="px-6 py-10 text-center sm:px-10">
              <p className="text-sm leading-6 text-[#878787]">
                Order details aren't available in this view.
                Visit{" "}
                <Link
                  to="/orders"
                  className="cursor-pointer font-semibold text-[#2874F0] hover:underline"
                >
                  your orders
                </Link>{" "}
                to find your recent purchases.
              </p>

              <Link
                to="/shop"
                className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
              >
                Continue shopping
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

export default OrderSuccess;