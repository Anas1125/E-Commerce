import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Tag,
  TicketPercent,
  Truck,
  X,
} from "lucide-react";

import { Link, useNavigate } from "react-router-dom";

import api from "../services/api";
import useAuth from "../context/useAuth";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

import {
  EmptyState,
  LoadingState,
  Price,
} from "../components/Storefront";

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");

    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });

function Checkout() {
  const {
    user,
    isAuthenticated,
    refreshCounts,
    updateUser,
  } = useAuth();
  const navigate = useNavigate();
  const { siteName = "TerraLens" } = useContext(
    SiteBrandingContext,
  );
  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState("");

  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const [couponsOpen, setCouponsOpen] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [confirmedCod, setConfirmedCod] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);
  const [editingContact, setEditingContact] = useState(null);
  const [contactValue, setContactValue] = useState("");
  const [contactSaving, setContactSaving] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

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
        requestError.response?.data?.detail ||
          "Unable to prepare checkout.",
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const timer = setTimeout(load, 0);

    return () => clearTimeout(timer);
  }, [load]);

  const selectedAddress = useMemo(
    () =>
      addresses.find(
        (address) => String(address.id) === String(selected),
      ),
    [addresses, selected],
  );

  const subtotal = Number(cart?.subtotal || 0);

  const couponDiscount = Number(
    appliedCoupon?.discount_amount || 0,
  );

  const estimatedTotal = Math.max(
    0,
    subtotal - couponDiscount,
  );

  const applyCoupon = async (couponCode = coupon) => {
    const code = couponCode.trim();

    if (!code) {
      setError("Enter a coupon code.");
      return false;
    }

    setCouponLoading(true);
    setError("");

    try {
      const { data } = await api.post("/coupons/validate", {
        code,
      });

      setCoupon(data.code || code);
      setAppliedCoupon(data);

      return true;
    } catch (requestError) {
      setAppliedCoupon(null);

      setError(
        requestError.response?.data?.detail ||
          "Unable to apply this coupon.",
      );

      return false;
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setCoupon("");
    setAppliedCoupon(null);
    setError("");
  };

  const openCoupons = async () => {
    setCouponsOpen(true);
    setCouponsLoading(true);
    setError("");

    try {
      const { data } = await api.get("/coupons/available");
      setAvailableCoupons(data);
    } catch (requestError) {
      setAvailableCoupons([]);

      setError(
        requestError.response?.data?.detail ||
          "Unable to load available coupons.",
      );
    } finally {
      setCouponsLoading(false);
    }
  };

  const closeCoupons = () => {
    if (!couponLoading) {
      setCouponsOpen(false);
    }
  };

  const handleCouponSelect = async (couponItem) => {
    if (!couponItem.eligible || couponLoading) {
      return;
    }

    const success = await applyCoupon(couponItem.code);

    if (success) {
      setCouponsOpen(false);
    }
  };

  const startContactEdit = (type) => {
    setEditingContact(type);

    if (type === "phone") {
      setContactValue(user?.phone_number || "");
    } else {
      setContactValue(user?.email || "");
    }

    setError("");
  };

  const cancelContactEdit = () => {
    if (contactSaving) {
      return;
    }

    setEditingContact(null);
    setContactValue("");
  };

  const saveContact = async () => {
    const value = contactValue.trim();

    if (!value) {
      setError(
        editingContact === "phone"
          ? "Enter a phone number."
          : "Enter an email address.",
      );
      return;
    }

    if (editingContact === "phone" && !/^\+?[0-9\s()-]{7,20}$/.test(value)) {
      setError("Enter a valid phone number.");
      return;
    }

    if (
      editingContact === "email" &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      setError("Enter a valid email address.");
      return;
    }

    setContactSaving(true);
    setError("");

    try {
      const payload =
        editingContact === "phone"
          ? { phone_number: value }
          : { email: value };

      const { data } = await api.patch(
        "/auth/me/contact",
        payload,
      );

      updateUser(data);

      setEditingContact(null);
      setContactValue("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Unable to update your contact information.",
      );
    } finally {
      setContactSaving(false);
    }
  };

  const placeOrder = async () => {
    if (!selected) {
      setError("Select a delivery address.");
      setStep(1);
      return;
    }

    if (paymentMethod === "cod" && !confirmedCod) {
      setError(
        "Confirm that you will pay for the order on delivery.",
      );
      return;
    }

    setBusy(true);
    setError("");

    try {
      const { data: order } = await api.post("/orders/", {
        shipping_address_id: Number(selected),
        coupon_code: appliedCoupon?.code || null,
        payment_method: paymentMethod,
      });

      if (paymentMethod === "cod") {
        await refreshCounts();

        navigate("/order-success", {
          state: { order },
        });

        return;
      }

      const razorpayLoaded = await loadRazorpay();

      if (!razorpayLoaded) {
        throw new Error(
          "Unable to load Razorpay Checkout. Please try again.",
        );
      }

      const { data: payment } = await api.post("/payments/", {
        order_id: order.id,
      });

      const razorpayOptions = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: Math.round(
          Number(payment.amount) * 100,
        ),
        currency: payment.currency,
        name: siteName,
        description: `Order ${order.order_number}`,
        order_id: payment.gateway_order_id,
        prefill: {
          name: [
            user?.first_name,
            user?.last_name,
          ]
            .filter(Boolean)
            .join(" "),
          email: user?.email || "",
          contact: user?.phone_number || "",
        },
        theme: {
          color: "#2874F0",
        },
        method: {
          upi: true,
        },
        handler: async (response) => {
          try {
            setBusy(true);
            setError("");
            await api.post("/payments/complete", {
              payment_id: payment.id,
              gateway_order_id:
                response.razorpay_order_id,
              gateway_payment_id:
                response.razorpay_payment_id,
              gateway_signature:
                response.razorpay_signature,
              payment_method: "upi",
            });
            await refreshCounts();
            navigate("/order-success", {
              state: {
                order: {
                  ...order,
                  order_status: "confirmed",
                  payment_status: "paid",
                },
              },
            });
          } catch (verificationError) {
            setError(
              verificationError.response?.data?.detail ||
                "Payment was received, but verification failed. Please contact support.",
            );
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: async () => {
            try {
              await api.post("/payments/fail", {
                payment_id: payment.id,
              });
            } catch {
              // Payment cancellation is handled silently here.
            }
            setBusy(false);
            setError(
              "UPI payment was cancelled. Your order was not completed.",
            );
          },
        },
      }; 

      const razorpay = new window.Razorpay(
        razorpayOptions,
      );

      razorpay.on(
        "payment.failed",
        async () => {
          try {
            await api.post("/payments/fail", {
              payment_id: payment.id,
            });
          } catch {
            // The backend failure endpoint is best-effort here.
          }

          setBusy(false);

          setError(
            "UPI payment failed. Please try again.",
          );
        },
      );

      razorpay.open();
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          requestError.message ||
          "We couldn't start the payment. Please try again.",
      );

      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-6 py-12">
        <SEO
          title="Checkout"
          description={`Complete your ${siteName} order securely.`}
          noIndex
        />
        <div className="mx-auto max-w-7xl">
          <LoadingState />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-6 py-20">
        <SEO
          title="Checkout"
          description={`Complete your ${siteName} order securely.`}
          noIndex
        />
        <div className="mx-auto max-w-4xl">
          <EmptyState
            title="Sign in to check out"
            text="Your cart and delivery details are linked to your account."
            action="Sign in"
            to="/login"
          />
        </div>
      </div>
    );
  }

  if (!cart?.items?.length) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-6 py-20">
        <SEO
          title="Checkout"
          description={`Complete your ${siteName} order securely.`}
          noIndex
        />
        <div className="mx-auto max-w-4xl">
          <EmptyState
            title="Your cart is empty"
            text="Add something to your cart before checkout."
            action="Continue shopping"
            to="/shop"
          />
        </div>
      </div>
    );
  }

  return (
    <>
    <SEO
      title="Checkout"
      description={`Complete your ${siteName} order securely.`}
      noIndex
    />
      <div className="min-h-screen bg-[#F1F3F6] pb-16">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {/* HEADER */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2874F0]">
                Secure checkout
              </p>

              <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#212121]">
                Checkout
              </h1>
            </div>

            <Link
              to="/cart"
              className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#2874F0] hover:underline"
            >
              <ArrowLeft size={16} />
              Back to cart
            </Link>
          </div>

          {/* PROGRESS */}
          <div className="mb-6 rounded-md border border-[#E0E0E0] bg-white px-5 py-4">
            <div className="flex items-center justify-center gap-3 sm:gap-8">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    step >= 1
                      ? "bg-[#2874F0] text-white"
                      : "bg-[#E0E0E0] text-[#878787]"
                  }`}
                >
                  {step > 1 ? <Check size={16} /> : "1"}
                </div>

                <span
                  className={`text-sm font-semibold ${
                    step >= 1
                      ? "text-[#212121]"
                      : "text-[#878787]"
                  }`}
                >
                  Delivery
                </span>
              </div>

              <div className="h-px w-12 bg-[#E0E0E0] sm:w-24" />

              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    step >= 2
                      ? "bg-[#2874F0] text-white"
                      : "bg-[#E0E0E0] text-[#878787]"
                  }`}
                >
                  2
                </div>

                <span
                  className={`text-sm font-semibold ${
                    step >= 2
                      ? "text-[#212121]"
                      : "text-[#878787]"
                  }`}
                >
                  Review & Payment
                </span>
              </div>
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div
              role="alert"
              className="mb-5 rounded-md border border-[#F2C7C2] bg-[#FFF1EF] px-4 py-3 text-sm text-[#C62828]"
            >
              {error}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[1fr_390px]">
            {/* LEFT */}
            <div className="space-y-5">
              {/* STEP 1 */}
              {step === 1 ? (
                <>
                  {/* DELIVERY ADDRESS */}
                  <section className="rounded-md border border-[#E0E0E0] bg-white">
                    <div className="border-b border-[#E0E0E0] px-5 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
                            <MapPin size={18} />
                          </div>

                          <div>
                            <h2 className="font-bold text-[#212121]">
                              Delivery Address
                            </h2>

                            <p className="text-xs text-[#878787]">
                              Choose where you want your order delivered
                            </p>
                          </div>
                        </div>

                        <Link
                          to="/addresses"
                          className="cursor-pointer text-sm font-semibold text-[#2874F0]"
                        >
                          Manage
                        </Link>
                      </div>
                    </div>

                    <div className="p-5">
                      {addresses.length === 0 ? (
                        <div className="rounded-md border border-dashed border-[#D0D0D0] p-8 text-center">
                          <MapPin
                            size={30}
                            className="mx-auto text-[#878787]"
                          />

                          <p className="mt-3 text-sm text-[#878787]">
                            You don't have a saved delivery address.
                          </p>

                          <Link
                            to="/addresses"
                            className="mt-4 inline-flex cursor-pointer rounded-md bg-[#2874F0] px-6 py-3 text-sm font-semibold !text-white hover:bg-[#1f65d6]"
                          >
                            Add delivery address
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {addresses.map((address) => {
                            const isSelected =
                              String(address.id) ===
                              String(selected);

                            return (
                              <label
                                key={address.id}
                                className={`block cursor-pointer rounded-md border p-4 transition ${
                                  isSelected
                                    ? "border-[#2874F0] bg-[#F5F9FF]"
                                    : "border-[#E0E0E0] hover:border-[#A0A0A0]"
                                }`}
                              >
                                <div className="flex gap-3">
                                  <input
                                    type="radio"
                                    name="address"
                                    value={address.id}
                                    checked={isSelected}
                                    onChange={(event) =>
                                      setSelected(
                                        event.target.value,
                                      )
                                    }
                                    className="mt-1 cursor-pointer"
                                  />

                                  <div className="flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-semibold text-[#212121]">
                                        {address.address_line1}
                                      </span>

                                      {address.is_default && (
                                        <span className="rounded-sm bg-[#E8F5E9] px-2 py-1 text-[10px] font-bold uppercase text-[#388E3C]">
                                          Default
                                        </span>
                                      )}
                                    </div>

                                    {address.address_line2 && (
                                      <p className="mt-1 text-sm text-[#555]">
                                        {address.address_line2}
                                      </p>
                                    )}

                                    <p className="mt-1 text-sm text-[#555]">
                                      {address.city},{" "}
                                      {address.state}{" "}
                                      {address.postal_code}
                                    </p>

                                    <p className="mt-1 text-sm text-[#878787]">
                                      {address.country}
                                    </p>
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* CONTACT INFORMATION */}
                  <section className="rounded-md border border-[#E0E0E0] bg-white">
                    <div className="border-b border-[#E0E0E0] px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
                          <Phone size={18} />
                        </div>

                        <div>
                          <h2 className="font-bold text-[#212121]">
                            Contact Information
                          </h2>

                          <p className="text-xs text-[#878787]">
                            We'll use these details for delivery updates
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 p-5 sm:grid-cols-2">

                      {/* PHONE */}
                      <div className="rounded-md border border-[#E0E0E0] bg-[#FAFAFA] p-4">
                        {editingContact === "phone" ? (
                          <div>
                            <div className="flex items-center gap-3">
                              <Phone
                                size={18}
                                className="shrink-0 text-[#2874F0]"
                              />

                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                                  Phone number
                                </p>

                                <input
                                  type="tel"
                                  value={contactValue}
                                  onChange={(event) => {
                                    setContactValue(event.target.value);
                                    setError("");
                                  }}
                                  placeholder="Enter phone number"
                                  autoFocus
                                  disabled={contactSaving}
                                  className="mt-2 h-10 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm font-semibold text-[#212121] outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelContactEdit}
                                disabled={contactSaving}
                                className="cursor-pointer rounded-md border border-[#D0D0D0] bg-white px-4 py-2 text-xs font-semibold text-[#555] hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                onClick={saveContact}
                                disabled={contactSaving}
                                className="cursor-pointer rounded-md bg-[#2874F0] px-4 py-2 text-xs font-bold !text-white hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {contactSaving ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <Phone
                                size={18}
                                className="mt-0.5 shrink-0 text-[#2874F0]"
                              />

                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                                  Phone number
                                </p>

                                <p className="mt-1 break-words text-sm font-semibold text-[#212121]">
                                  {user?.phone_number || "Phone number not added"}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => startContactEdit("phone")}
                              className="shrink-0 cursor-pointer text-sm font-semibold text-[#2874F0] hover:underline"
                            >
                              {user?.phone_number ? "Edit" : "Add"}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* EMAIL */}
                      <div className="rounded-md border border-[#E0E0E0] bg-[#FAFAFA] p-4">
                        {editingContact === "email" ? (
                          <div>
                            <div className="flex items-center gap-3">
                              <Mail
                                size={18}
                                className="shrink-0 text-[#2874F0]"
                              />

                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                                  Email address
                                </p>

                                <input
                                  type="email"
                                  value={contactValue}
                                  onChange={(event) => {
                                    setContactValue(event.target.value);
                                    setError("");
                                  }}
                                  placeholder="Enter email address"
                                  autoFocus
                                  disabled={contactSaving}
                                  className="mt-2 h-10 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm font-semibold text-[#212121] outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelContactEdit}
                                disabled={contactSaving}
                                className="cursor-pointer rounded-md border border-[#D0D0D0] bg-white px-4 py-2 text-xs font-semibold text-[#555] hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                onClick={saveContact}
                                disabled={contactSaving}
                                className="cursor-pointer rounded-md bg-[#2874F0] px-4 py-2 text-xs font-bold !text-white hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {contactSaving ? "Saving..." : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <Mail
                                size={18}
                                className="mt-0.5 shrink-0 text-[#2874F0]"
                              />

                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                                  Email address
                                </p>

                                <p className="mt-1 break-words text-sm font-semibold text-[#212121]">
                                  {user?.email || "Email not available"}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => startContactEdit("email")}
                              className="shrink-0 cursor-pointer text-sm font-semibold text-[#2874F0] hover:underline"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* CONTINUE */}
                  {addresses.length > 0 && (
                    <button
                      type="button"
                      disabled={!selected}
                      onClick={() => {
                        setError("");
                        setStep(2);
                      }}
                      className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-6 py-3.5 text-sm font-bold !text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Continue to review
                      <ArrowRight size={17} />
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* DELIVERY SUMMARY */}
                  <section className="rounded-md border border-[#E0E0E0] bg-white">
                    <div className="flex items-center justify-between border-b border-[#E0E0E0] px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2874F0] text-sm font-bold text-white">
                          <Check size={16} />
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase text-[#878787]">
                            Delivery
                          </p>

                          <p className="text-sm font-semibold text-[#212121]">
                            {selectedAddress?.address_line1},{" "}
                            {selectedAddress?.city}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="cursor-pointer text-sm font-semibold text-[#2874F0]"
                      >
                        Change
                      </button>
                    </div>
                  </section>

                  {/* CONTACT SUMMARY */}
                  <section className="rounded-md border border-[#E0E0E0] bg-white">
                    <div className="border-b border-[#E0E0E0] px-5 py-4">
                      <h2 className="font-bold text-[#212121]">
                        Contact Information
                      </h2>
                    </div>

                    <div className="grid gap-3 p-5 sm:grid-cols-2">
                      <div className="flex items-center gap-3">
                        <Phone
                          size={17}
                          className="text-[#2874F0]"
                        />

                        <div className="min-w-0">
                          <p className="text-xs text-[#878787]">
                            Phone
                          </p>

                          <p className="break-words text-sm font-semibold text-[#212121]">
                            {user?.phone_number ||
                              "Phone number not added"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Mail
                          size={17}
                          className="text-[#2874F0]"
                        />

                        <div className="min-w-0">
                          <p className="text-xs text-[#878787]">
                            Email
                          </p>

                          <p className="break-words text-sm font-semibold text-[#212121]">
                            {user?.email || "Email not available"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* PAYMENT */}
                  <section className="rounded-md border border-[#E0E0E0] bg-white">
                    <div className="border-b border-[#E0E0E0] px-5 py-4">
                      <h2 className="font-bold text-[#212121]">
                        Payment Method
                      </h2>

                      <p className="mt-1 text-xs text-[#878787]">
                        Select your preferred payment option
                      </p>
                    </div>

                    <div className="p-5">
                      <div className="space-y-3">
                        {[
                          ["cod", "Cash on Delivery"],
                          ["upi", "UPI"],
                        ].map(([value, label]) => {
                          const disabled = false;

                          return (
                            <label
                              key={value}
                              className={`flex items-center justify-between rounded-md border p-4 ${
                                disabled
                                  ? "cursor-not-allowed opacity-60"
                                  : "cursor-pointer"
                              } ${
                                paymentMethod === value
                                  ? "border-[#2874F0] bg-[#F5F9FF]"
                                  : "border-[#E0E0E0]"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name="payment-method"
                                  value={value}
                                  disabled={disabled}
                                  checked={paymentMethod === value}
                                  onChange={() => {
                                    setPaymentMethod(value);
                                    setError("");
                                  }}
                                  className={
                                    disabled
                                      ? "cursor-not-allowed"
                                      : "cursor-pointer"
                                  }
                                />

                                <span className="text-sm font-semibold text-[#212121]">
                                  {label}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      {paymentMethod === "cod" && (
                        <div className="mt-4 rounded-md border border-[#C8E6C9] bg-[#F1F8F2] p-4">
                          <div className="flex gap-3">
                            <ShieldCheck
                              size={20}
                              className="mt-0.5 text-[#388E3C]"
                            />

                            <div className="text-sm">
                              <p className="font-semibold text-[#2E7D32]">
                                Cash on Delivery
                              </p>

                              <p className="mt-1 leading-5 text-[#555]">
                                Pay the final order amount when your
                                order is delivered.
                              </p>

                              <label className="mt-3 flex cursor-pointer items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={confirmedCod}
                                  onChange={(event) =>
                                    setConfirmedCod(event.target.checked)
                                  }
                                  className="mt-0.5 cursor-pointer"
                                />

                                <span className="text-sm text-[#444]">
                                  I'll pay the order total when it
                                  is delivered.
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* COUPON */}
                  <section className="rounded-md border border-[#E0E0E0] bg-white">
                    <div className="border-b border-[#E0E0E0] px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFF4D6] text-[#F5A623]">
                            <Tag size={18} />
                          </div>

                          <div>
                            <h2 className="font-bold text-[#212121]">
                              Apply Coupon
                            </h2>

                            <p className="text-xs text-[#878787]">
                              Save more on your order
                            </p>
                          </div>
                        </div>

                        {!appliedCoupon && (
                          <button
                            type="button"
                            onClick={openCoupons}
                            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-bold text-[#2874F0] hover:text-[#1f65d6]"
                          >
                            <TicketPercent size={16} />
                            View all coupons
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-5">
                      {appliedCoupon ? (
                        <div className="flex items-center justify-between rounded-md border border-[#C8E6C9] bg-[#F1F8F2] p-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <Check
                                size={17}
                                className="text-[#388E3C]"
                              />

                              <span className="font-bold text-[#2E7D32]">
                                {appliedCoupon.code}
                              </span>
                            </div>

                            <p className="mt-1 text-sm text-[#555]">
                              You saved{" "}
                              <strong>
                                ₹
                                {couponDiscount.toLocaleString(
                                  "en-IN",
                                )}
                              </strong>
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={removeCoupon}
                            className="cursor-pointer text-sm font-semibold text-[#2874F0]"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            value={coupon}
                            onChange={(event) => {
                              setCoupon(
                                event.target.value.toUpperCase(),
                              );
                              setError("");
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                applyCoupon();
                              }
                            }}
                            placeholder="Enter coupon code"
                            className="h-12 flex-1 rounded-md border border-[#D0D0D0] px-4 text-sm uppercase outline-none transition focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                          />

                          <button
                            type="button"
                            onClick={() => applyCoupon()}
                            disabled={
                              couponLoading || !coupon.trim()
                            }
                            className="h-12 cursor-pointer rounded-md border border-[#2874F0] px-7 text-sm font-bold text-[#2874F0] transition hover:bg-[#F5F9FF] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {couponLoading
                              ? "Applying..."
                              : "Apply"}
                          </button>
                        </div>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>

            {/* RIGHT — ORDER SUMMARY */}
            <aside className="h-fit overflow-hidden rounded-md border border-[#E0E0E0] bg-white">
              <div className="border-b border-[#E0E0E0] px-5 py-4">
                <h2 className="text-lg font-bold text-[#212121]">
                  Order Summary
                </h2>
              </div>

              <div className="p-5">
                {/* PRODUCTS */}
                <div className="space-y-4">
                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#212121]">
                          {item.product_name}
                        </p>

                        <p className="mt-1 text-xs text-[#878787]">
                          Qty: {item.quantity}
                        </p>
                      </div>

                      <Price
                        value={item.line_total}
                        className="shrink-0 text-sm font-semibold"
                      />
                    </div>
                  ))}
                </div>

                <div className="my-5 border-t border-[#E0E0E0]" />

                {/* PRICE BREAKDOWN */}
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#555]">
                      Subtotal
                    </span>

                    <Price value={subtotal} />
                  </div>

                  {appliedCoupon && (
                    <div className="flex justify-between text-[#388E3C]">
                      <span>Coupon discount</span>

                      <span className="font-semibold">
                        - ₹
                        {couponDiscount.toLocaleString(
                          "en-IN",
                        )}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[#555]">
                      <Truck size={16} />
                      Shipping
                    </span>

                    <span className="font-semibold text-[#388E3C]">
                      FREE
                    </span>
                  </div>
                </div>

                <div className="my-5 border-t border-[#E0E0E0]" />

                {/* TOTAL */}
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-[#212121]">
                    Total
                  </span>

                  <span className="text-xl font-bold text-[#212121]">
                    ₹
                    {estimatedTotal.toLocaleString("en-IN")}
                  </span>
                </div>

                {appliedCoupon && (
                  <div className="mt-3 rounded-md bg-[#F1F8F2] px-3 py-2 text-xs text-[#388E3C]">
                    Coupon applied successfully. Final
                    discounts and stock are verified again when
                    the order is placed.
                  </div>
                )}

                {/* STEP 2 BUTTON */}
                {step === 2 && (
                  <button
                    type="button"
                    disabled={
                      busy ||
                      !selected ||
                      (paymentMethod === "cod" && !confirmedCod)
                    }
                    onClick={placeOrder}
                    className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-5 py-3.5 text-sm font-bold !text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? (
                      "Placing order..."
                    ) : (
                      <>
                        {paymentMethod === "cod"
                          ? "Confirm COD Order"
                          : "Pay with UPI"}
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                )}

                <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#878787]">
                  <ShieldCheck size={15} />
                  Secure checkout
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* COUPON MODAL */}
      {couponsOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCoupons();
            }
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-[#E0E0E0] px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-[#212121]">
                  Available Coupons
                </h2>

                <p className="mt-1 text-xs text-[#878787]">
                  Choose a coupon and apply it to this order.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCoupons}
                disabled={couponLoading}
                aria-label="Close coupons"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#555] transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* MODAL CONTENT */}
            <div className="overflow-y-auto p-5">
              {couponsLoading ? (
                <div className="py-12">
                  <LoadingState />
                </div>
              ) : availableCoupons.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#D0D0D0] px-5 py-12 text-center">
                  <TicketPercent
                    size={38}
                    className="mx-auto text-[#878787]"
                  />

                  <h3 className="mt-4 font-bold text-[#212121]">
                    No coupons available
                  </h3>

                  <p className="mt-1 text-sm text-[#878787]">
                    There are no active coupons available for
                    this account right now.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableCoupons.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-md border p-4 transition ${
                        item.eligible
                          ? "border-[#D7E5FF] bg-[#F8FBFF]"
                          : "border-[#E0E0E0] bg-[#FAFAFA]"
                      }`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded border border-dashed px-3 py-1 text-xs font-bold tracking-wide ${
                                item.eligible
                                  ? "border-[#2874F0] bg-white text-[#2874F0]"
                                  : "border-[#BDBDBD] bg-white text-[#878787]"
                              }`}
                            >
                              {item.code}
                            </span>

                            {item.eligible && (
                              <span className="rounded-full bg-[#E8F5E9] px-2 py-1 text-[10px] font-bold uppercase text-[#388E3C]">
                                Eligible
                              </span>
                            )}
                          </div>

                          <h3 className="mt-3 font-bold text-[#212121]">
                            {item.name}
                          </h3>

                          <p className="mt-1 text-sm text-[#555]">
                            {item.discount_type === "percentage"
                              ? `${item.value}% off`
                              : `₹${Number(
                                  item.value,
                                ).toLocaleString(
                                  "en-IN",
                                )} off`}
                          </p>

                          {Number(
                            item.minimum_order_amount || 0,
                          ) > 0 && (
                            <p className="mt-1 text-xs text-[#878787]">
                              Minimum order: ₹
                              {Number(
                                item.minimum_order_amount,
                              ).toLocaleString("en-IN")}
                            </p>
                          )}

                          {item.maximum_discount &&
                            item.discount_type ===
                              "percentage" && (
                              <p className="mt-1 text-xs text-[#878787]">
                                Maximum discount: ₹
                                {Number(
                                  item.maximum_discount,
                                ).toLocaleString("en-IN")}
                              </p>
                            )}

                          {item.first_order_only && (
                            <p className="mt-1 text-xs font-semibold text-[#2874F0]">
                              Valid for first order only
                            </p>
                          )}

                          {!item.eligible && (
                            <p className="mt-2 text-xs font-semibold text-[#C62828]">
                              {item.reason}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={
                            !item.eligible || couponLoading
                          }
                          onClick={() =>
                            handleCouponSelect(item)
                          }
                          className="shrink-0 cursor-pointer rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-bold !text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:bg-[#E0E0E0] disabled:text-[#878787]"
                        >
                          {couponLoading
                            ? "Applying..."
                            : item.eligible
                              ? "Apply"
                              : "Not eligible"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="border-t border-[#E0E0E0] bg-[#FAFAFA] px-5 py-3">
              <button
                type="button"
                onClick={closeCoupons}
                disabled={couponLoading}
                className="ml-auto block cursor-pointer rounded-md border border-[#D0D0D0] bg-white px-5 py-2.5 text-sm font-semibold text-[#212121] hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Checkout;