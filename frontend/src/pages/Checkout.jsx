import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import useAuth from "../context/useAuth";
import {
  EmptyState,
  LoadingState,
  PageIntro,
  Price,
} from "../components/Storefront";

function Checkout() {
  const { isAuthenticated, refreshCounts } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState("");
  const [coupon, setCoupon] = useState(location.state?.coupon || "");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [confirmedCod, setConfirmedCod] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const [cartResponse, addressResponse] = await Promise.all([
        api.get("/cart/"),
        api.get("/addresses/"),
      ]);
      setCart(cartResponse.data);
      setAddresses(addressResponse.data);
      setSelected(
        String(
          addressResponse.data.find((item) => item.is_default)?.id ||
            addressResponse.data[0]?.id ||
            "",
        ),
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail || "Unable to prepare checkout.",
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const placeCodOrder = async () => {
    if (paymentMethod !== "cod") {
      setError(
        "Online payments are currently unavailable because no gateway integration is configured. Select Cash on Delivery to continue.",
      );
      return;
    }
    if (!confirmedCod) {
      setError("Confirm that you will pay for the order on delivery.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const { data: order } = await api.post("/orders/", {
        shipping_address_id: Number(selected),
        coupon_code: coupon.trim() || null,
        payment_method: "cod",
      });
      await refreshCounts();
      navigate("/order-success", { state: { order } });
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "We couldn’t place this order. Check stock, address and coupon details.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <LoadingState />
      </div>
    );
  if (!isAuthenticated)
    return (
      <div className="mx-auto max-w-4xl px-6 py-20">
        <EmptyState
          title="Sign in to check out"
          text="Your cart and delivery details are linked to your account."
          action="Sign in"
          to="/login"
        />
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <PageIntro
        eyebrow="Almost home"
        title="Checkout"
        description="Your order total, discounts and stock are confirmed by TerraLens."
      />
      <div className="mb-8 flex gap-2 text-xs sm:text-sm">
        <span
          className={`rounded-full px-4 py-2 ${step === 1 ? "bg-[#486B57] text-white" : "bg-[#e8ebe5] text-[#56635a]"}`}
        >
          1 · Delivery
        </span>
        <span
          className={`rounded-full px-4 py-2 ${step === 2 ? "bg-[#486B57] text-white" : "bg-[#e8ebe5] text-[#56635a]"}`}
        >
          2 · Review & payment
        </span>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-[#f8e8e3] p-4 text-sm text-[#8b4033]"
        >
          {error}
        </p>
      )}
      {!cart?.items?.length ? (
        <EmptyState
          title="Your cart is empty"
          text="Add something to your cart before checkout."
          action="Browse the shop"
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="space-y-5">
            {step === 1 ? (
              <div className="rounded-2xl border border-[#E3E5DF] bg-white p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Delivery address</h2>
                  <Link
                    className="text-sm font-medium text-[#486B57]"
                    to="/addresses"
                  >
                    Manage
                  </Link>
                </div>
                {addresses.length === 0 ? (
                  <div className="mt-5">
                    <p className="text-sm text-[#737A74]">
                      Add an address before placing your order.
                    </p>
                    <Link
                      to="/addresses"
                      className="button-primary mt-4 inline-flex"
                    >
                      Add delivery address
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="mt-5 space-y-3">
                      {addresses.map((address) => (
                        <label
                          key={address.id}
                          className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${String(address.id) === selected ? "border-[#486B57] bg-[#f5f7f3]" : "border-[#E3E5DF]"}`}
                        >
                          <input
                            type="radio"
                            name="address"
                            value={address.id}
                            checked={String(address.id) === selected}
                            onChange={(event) =>
                              setSelected(event.target.value)
                            }
                          />
                          <span className="text-sm leading-6">
                            {address.address_line1}
                            {address.address_line2 &&
                              `, ${address.address_line2}`}
                            <br />
                            {address.city}, {address.state}{" "}
                            {address.postal_code}, {address.country}
                            {address.is_default && (
                              <em className="ml-2 text-xs text-[#486B57]">
                                Default
                              </em>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                    <button
                      disabled={!selected}
                      className="button-primary mt-5"
                      onClick={() => setStep(2)}
                    >
                      Continue to review
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E3E5DF] bg-white p-6">
                <div className="flex justify-between">
                  <h2 className="text-lg font-semibold">Delivery & payment</h2>
                  <button
                    className="text-sm text-[#486B57]"
                    onClick={() => setStep(1)}
                  >
                    Change address
                  </button>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#737A74]">
                  {
                    addresses.find((address) => String(address.id) === selected)
                      ?.address_line1
                  }
                  ,{" "}
                  {
                    addresses.find((address) => String(address.id) === selected)
                      ?.city
                  }
                </p>
                <fieldset className="mt-6 border-t border-[#E3E5DF] pt-5">
                  <legend className="font-medium">Payment method</legend>
                  <div className="mt-3 space-y-3">
                    {[
                      ["cod", "Cash on Delivery"],
                      ["upi", "UPI"],
                      ["card", "Card"],
                    ].map(([value, label]) => (
                      <label
                        key={value}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#E3E5DF] p-4"
                      >
                        <input
                          type="radio"
                          name="payment-method"
                          value={value}
                          checked={paymentMethod === value}
                          onChange={() => {
                            setPaymentMethod(value);
                            setError("");
                          }}
                        />
                        <span className="text-sm font-medium">{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {paymentMethod === "cod" ? (
                  <div className="mt-4 rounded-xl bg-[#e9eee8] p-4 text-sm text-[#385744]">
                    <p className="font-medium">Cash on Delivery</p>
                    <p className="mt-1">
                      Your order will be confirmed with payment pending until
                      collection on delivery.
                    </p>
                    <label className="mt-3 flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={confirmedCod}
                        onChange={(event) =>
                          setConfirmedCod(event.target.checked)
                        }
                      />
                      <span>
                        I’ll pay the order total when it is delivered.
                      </span>
                    </label>
                  </div>
                ) : (
                  <p
                    role="status"
                    className="mt-4 rounded-xl bg-[#f8e8e3] p-4 text-sm text-[#8b4033]"
                  >
                    {paymentMethod === "upi" ? "UPI" : "Card"} payment is
                    currently unavailable. No payment gateway is configured, so
                    no order will be created for this payment method.
                  </p>
                )}
                <label className="mt-5 block text-sm font-medium">
                  Coupon code (optional)
                  <input
                    className="field mt-2"
                    value={coupon}
                    onChange={(event) => setCoupon(event.target.value)}
                    placeholder="Enter coupon code"
                  />
                </label>
                <button
                  disabled={
                    busy ||
                    !selected ||
                    (paymentMethod === "cod" && !confirmedCod)
                  }
                  className="button-primary mt-6 w-full"
                  onClick={placeCodOrder}
                >
                  {busy
                    ? "Placing order…"
                    : paymentMethod === "cod"
                      ? "Confirm COD order"
                      : "Online payment unavailable"}
                </button>
              </div>
            )}
          </section>
          <aside className="h-fit rounded-2xl border border-[#E3E5DF] bg-white p-6">
            <h2 className="font-semibold">Order summary</h2>
            <div className="mt-5 space-y-3">
              {cart.items.map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between gap-4 text-sm"
                >
                  <span className="text-[#737A74]">
                    {item.product_name} × {item.quantity}
                  </span>
                  <Price value={item.line_total} />
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-between border-t border-[#E3E5DF] pt-4 font-semibold">
              <span>Cart subtotal</span>
              <Price value={cart.subtotal} />
            </div>
            <p className="mt-3 text-xs leading-5 text-[#737A74]">
              Final discounts, delivery and order total are calculated by the
              server.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}

export default Checkout;
