import {
  useContext,
  useEffect,
  useMemo,
  useRef,
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

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import api from "../services/api";
import useAuth from "../context/useAuth";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

import {
  EmptyState,
  LoadingState,
  Price,
} from "../components/Storefront";

const NETWORK_ERROR =
  "Network problem. Check your connection and try again.";

const RAZORPAY_SCRIPT_SRC =
  "https://checkout.razorpay.com/v1/checkout.js";

const RAZORPAY_LOAD_TIMEOUT_MS = 10000;

const REFRESH_CART_STATUSES = [400, 409, 422];


const CHECKOUT_IDEMPOTENCY_STORAGE_KEY =
  "terralens_checkout_attempt_v1";

const CHECKOUT_PENDING_PAYMENT_STORAGE_KEY =
  "terralens_pending_payment_v1";

const readCheckoutAttempt = () => {
  try {
    const saved = sessionStorage.getItem(
      CHECKOUT_IDEMPOTENCY_STORAGE_KEY
    );
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const saveCheckoutAttempt = (attempt) => {
  try {
    sessionStorage.setItem(
      CHECKOUT_IDEMPOTENCY_STORAGE_KEY,
      JSON.stringify(attempt)
    );
  } catch {
    // In-memory refs still protect retries on this page.
  }
};

const readPendingPayment = () => {
  try {
    const saved = sessionStorage.getItem(
      CHECKOUT_PENDING_PAYMENT_STORAGE_KEY
    );
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const savePendingPayment = (payment) => {
  try {
    sessionStorage.setItem(
      CHECKOUT_PENDING_PAYMENT_STORAGE_KEY,
      JSON.stringify(payment)
    );
  } catch {
    // Payment recovery may still work in the current page.
  }
};

const clearCheckoutAttempt = () => {
  try {
    sessionStorage.removeItem(
      CHECKOUT_IDEMPOTENCY_STORAGE_KEY
    );
  } catch {
    // Storage may be unavailable.
  }

  try {
    sessionStorage.removeItem(
      CHECKOUT_PENDING_PAYMENT_STORAGE_KEY
    );
  } catch {
    // Storage may be unavailable.
  }
};


const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail) && detail[0]?.msg) {
    return String(detail[0].msg).replace(/^Value error,\s*/i, "");
  }

  if (error?.response) {
    return fallback;
  }

  if (error?.request) {
    return NETWORK_ERROR;
  }
  return fallback;
};

const userFacingError = (message) => {
  const error = new Error(message);
  error.isUserFacing = true;
  return error;
};

const formatINR = (value) => {
  const amount = Number(value || 0);

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const isValidPhone = (value) => {
  if (!/^\+?[0-9\s()-]{7,20}$/.test(value)) {
    return false;
  }

  const digits = value.replace(/\D/g, "");

  return (
    digits.length === 10 ||
    (digits.length === 11 && digits.startsWith("0")) ||
    (digits.length === 12 && digits.startsWith("91"))
  );
};

const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    let settled = false;

    const finish = (result, scriptToRemove) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);

      if (!result && scriptToRemove) {
        scriptToRemove.remove();
      }

      resolve(result);
    };

    const timer = setTimeout(
      () => finish(false, script),
      RAZORPAY_LOAD_TIMEOUT_MS,
    );

    let script = document.querySelector(
      `script[src="${RAZORPAY_SCRIPT_SRC}"]`,
    );

    if (script) {
      script.addEventListener(
        "load",
        () => finish(Boolean(window.Razorpay), script),
        { once: true },
      );

      script.addEventListener(
        "error",
        () => finish(false, script),
        { once: true },
      );

      return;
    }

    script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_SRC;

    script.onload = () =>
      finish(Boolean(window.Razorpay), script);

    script.onerror = () => finish(false, script);

    document.body.appendChild(script);
  });

function CheckoutContent() {
  const {
    user,
    isAuthenticated,
    loading: authLoading,
    refreshCounts,
    updateUser,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const { siteName = "TerraLens" } =
    useContext(SiteBrandingContext) || {};

  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  const [couponsOpen, setCouponsOpen] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [couponsLoading, setCouponsLoading] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [confirmedCod, setConfirmedCod] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const [paymentPending, setPaymentPending] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [paymentConfirmedFailed, setPaymentConfirmedFailed] = useState(false);
  const [paymentNeedsSupport, setPaymentNeedsSupport] = useState(false);

  const [editingContact, setEditingContact] = useState(null);
  const [contactValue, setContactValue] = useState("");
  const [contactSaving, setContactSaving] = useState(false);

  const busyRef = useRef(false);
  const confirmingRef = useRef(false);
  const paymentLockedRef = useRef(false);
  const pendingOrderRef = useRef(null);
  const pendingPaymentRef = useRef(null);
  const pendingIdempotencyRef = useRef(null);
  const confirmRef = useRef(null);
  const mountedRef = useRef(true);
  const errorRef = useRef(null);
  const modalRef = useRef(null);
  const couponLoadingRef = useRef(false);

  const hasPhone = Boolean(user?.phone_number);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user?.id) {
      return;
    }

    const saved = readPendingPayment();

    if (
      !saved ||
      String(saved.userId) !== String(user.id)
    ) {
      return;
    }

    const orderId = Number(saved.orderId);
    const paymentId = Number(saved.paymentId);

    if (
      !Number.isSafeInteger(orderId) ||
      orderId <= 0 ||
      !Number.isSafeInteger(paymentId) ||
      paymentId <= 0 ||
      typeof saved.orderKey !== "string" ||
      !saved.orderKey
    ) {
      return;
    }

    const order = {
      id: orderId,
      order_number: saved.orderNumber || String(orderId),
    };

    const payment = {
      id: paymentId,
      gateway_order_id: saved.gatewayOrderId,
      amount: saved.amount,
      currency: saved.currency,
    };

    pendingOrderRef.current = {
      key: saved.orderKey,
      order,
      idempotencyKey: saved.idempotencyKey,
    };

    pendingPaymentRef.current = {
      key: `${orderId}|${saved.orderKey}`,
      payment,
    };

    pendingIdempotencyRef.current = {
      userId: saved.userId,
      orderKey: saved.orderKey,
      idempotencyKey: saved.idempotencyKey,
    };
  }, [authLoading, isAuthenticated, user?.id]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      return;
    }

    let cancelled = false;

    const loadCheckout = async () => {
      try {
        const [cartResponse, addressResponse] =
          await Promise.all([
            api.get("/cart/"),
            api.get("/addresses/"),
          ]);

        if (cancelled) {
          return;
        }

        setCart(cartResponse.data);
        setAddresses(addressResponse.data);

        setSelected(
          String(
            addressResponse.data.find(
              (item) => item.is_default,
            )?.id ||
              addressResponse.data[0]?.id ||
              "",
          ),
        );

        const saved = readPendingPayment();

        if (
          saved &&
          String(saved.userId) === String(user?.id) &&
          Number.isSafeInteger(Number(saved.orderId)) &&
          Number(saved.orderId) > 0 &&
          Number.isSafeInteger(Number(saved.paymentId)) &&
          Number(saved.paymentId) > 0 &&
          typeof saved.orderKey === "string" &&
          saved.orderKey
        ) {
          const order = {
            id: Number(saved.orderId),
            order_number: saved.orderNumber || String(saved.orderId),
          };

          const payment = {
            id: Number(saved.paymentId),
            gateway_order_id: saved.gatewayOrderId,
            amount: saved.amount,
            currency: saved.currency,
          };

          pendingOrderRef.current = {
            key: saved.orderKey,
            order,
            idempotencyKey: saved.idempotencyKey,
          };

          pendingPaymentRef.current = {
            key: `${order.id}|${saved.orderKey}`,
            payment,
          };

          pendingIdempotencyRef.current = {
            userId: saved.userId,
            orderKey: saved.orderKey,
            idempotencyKey: saved.idempotencyKey,
          };
          setPaymentMethod("upi");
          setPaymentPending(order.order_number);
          setStep(2);
        }

        setError("");
      } catch (requestError) {
        if (cancelled) {
          return;
        }

        setError(
          getErrorMessage(
            requestError,
            "Unable to prepare checkout.",
          ),
        );
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    };

    loadCheckout();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, reloadKey]);

  useEffect(() => {
    if (!couponsOpen) {
      return;
    }

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (!couponLoadingRef.current) {
          setCouponsOpen(false);
        }
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) {
        return;
      }

      const focusable = modalRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusable.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [couponsOpen]);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [error]);

  const selectedAddress = useMemo(
    () =>
      addresses.find(
        (address) =>
          String(address.id) === String(selected),
      ),
    [addresses, selected],
  );

  const subtotal = Number(cart?.subtotal || 0);

  const dealDiscountTotal = Number(cart?.discount_total || 0);
  const couponDiscount = Number(
    appliedCoupon?.discount_amount || 0,
  );

  const estimatedTotal = Math.max(
    0,
    subtotal - dealDiscountTotal - couponDiscount,
  );
  const locked = busy || confirming || Boolean(paymentPending);

  const applyCoupon = async (couponCode = coupon) => {
    if (busyRef.current || couponLoadingRef.current) {
      return false;
    }

    const code = String(couponCode || "").trim();

    if (!code) {
      setCouponError("Enter a coupon code.");
      return false;
    }

    couponLoadingRef.current = true;
    setCouponLoading(true);
    setCouponError("");

    try {
      const { data } = await api.post("/coupons/validate", {
        code,
      });

      setCoupon(data.code || code);
      setAppliedCoupon(data);

      return true;
    } catch (requestError) {
      setAppliedCoupon(null);

      setCouponError(
        getErrorMessage(
          requestError,
          "Unable to apply this coupon.",
        ),
      );

      return false;
    } finally {
      couponLoadingRef.current = false;
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    if (busyRef.current) {
      return;
    }

    setCoupon("");
    setAppliedCoupon(null);
    setCouponError("");
  };

  const openCoupons = async () => {
    setCouponsOpen(true);
    setCouponsLoading(true);
    setCouponError("");

    try {
      const { data } = await api.get("/coupons/available");

      setAvailableCoupons(data);
    } catch (requestError) {
      setAvailableCoupons([]);

      setCouponError(
        getErrorMessage(
          requestError,
          "Unable to load available coupons.",
        ),
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

    setContactValue(
      type === "phone"
        ? user?.phone_number || ""
        : user?.email || "",
    );

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
    if (contactSaving) {
      return;
    }

    const value = contactValue.trim();

    if (!value) {
      setError(
        editingContact === "phone"
          ? "Enter a phone number."
          : "Enter an email address.",
      );
      return;
    }

    if (editingContact === "phone" && !isValidPhone(value)) {
      setError("Enter a valid 10-digit mobile number.");
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
          getErrorMessage(
            requestError,
            "Unable to update your contact information.",
          ),
        );
      } finally {
        setContactSaving(false);
      }
  };

  const releaseBusy = () => {
    busyRef.current = false;

    if (mountedRef.current) {
      setBusy(false);
    }
  };

  const refreshCart = async () => {
    try {
      const { data } = await api.get("/cart/");

      if (mountedRef.current) {
        setCart(data);
      }
    } catch {
      // Best effort: the original error is already on screen.
    }
  };
  

  const confirmPayment = async () => {
    const context = confirmRef.current;

    if (!context || confirmingRef.current) {
      return;
    }

    confirmingRef.current = true;
    setConfirming(true);
    setError("");

    const { order, payment, response } = context;

    try {
      const { data: paymentResult } = await api.post(
        "/payments/complete",
        {
          payment_id: payment.id,
          gateway_order_id: response.razorpay_order_id,
          gateway_payment_id: response.razorpay_payment_id,
          gateway_signature: response.razorpay_signature,
        },
      );

      if (
        paymentResult?.status !== "paid" ||
        paymentResult?.order_id !== order.id
      ) {
        throw userFacingError(
          "Payment has not been confirmed yet.",
        );
      }

      const { data: confirmedOrder } = await api.get(
        `/orders/${order.id}`,
      );

      if (
        confirmedOrder?.payment_status !== "paid" ||
        confirmedOrder?.order_status !== "confirmed"
      ) {
        throw userFacingError(
          "Payment was processed, but the order still needs confirmation.",
        );
      }

      confirmRef.current = null;
      pendingOrderRef.current = null;
      pendingPaymentRef.current = null;
      pendingIdempotencyRef.current = null;

      clearCheckoutAttempt();

      try {
        await refreshCounts();
      } catch {
        // The order is already confirmed.
      }

      navigate("/order-success", {
        state: {
          order: confirmedOrder,
          payment: paymentResult,
        },
      });
      } catch (requestError) {
        const needsSupport =
          requestError?.response?.status === 409;

        setPaymentConfirmedFailed(false);
        setPaymentNeedsSupport(needsSupport);
        setPaymentPending(order.order_number);

        setError(
          needsSupport
            ? `Payment may have been captured, but order ${order.order_number} needs reconciliation. Please don't pay again. Contact support to resolve this payment.`
            : `We couldn't confirm the final status of order ${order.order_number}. Please don't pay again. Check payment status or contact support.`,
        );

        releaseBusy();
      } finally {
      confirmingRef.current = false;

      if (mountedRef.current) {
        setConfirming(false);
      }
    }
  };

  const checkPaymentStatus = async () => {
    if (confirmingRef.current) return;

    const context = confirmRef.current;
    const payment =
      context?.payment ?? pendingPaymentRef.current?.payment;

    if (!payment?.id) {
      setError(
        "Payment details are unavailable in this checkout session. Please check My Orders and don't pay again."
      );
      return;
    }

    confirmingRef.current = true;
    setConfirming(true);
    setError("");

    try {
      const { data: paymentResult } = await api.post(
        "/payments/status",
        { payment_id: payment.id }
      );

      if (paymentResult?.status === "failed") {
        const failedOrder =
          context?.order ?? pendingOrderRef.current?.order;

        if (pendingOrderRef.current?.key) {
          pendingPaymentRef.current = {
            key: `${paymentResult.order_id}|${pendingOrderRef.current.key}`,
            payment: paymentResult,
          };
        }

        confirmRef.current = null;
        paymentLockedRef.current = false;

        setPaymentNeedsSupport(false);
        setPaymentConfirmedFailed(true);
        setPaymentPending(
          failedOrder?.order_number ?? paymentPending
        );

        setError(
          "Razorpay confirmed that all payment attempts failed. Your existing order is saved so you can retry without creating another order."
        );

        return;
      }

      if (paymentResult?.status !== "paid") {
        setPaymentConfirmedFailed(false);
        setPaymentNeedsSupport(false);
        setError(
          "Razorpay has not confirmed a captured payment yet. Your order remains unresolved. Please don't pay again; try checking again shortly."
        );
        return;
      }

      const { data: confirmedOrder } = await api.get(
        `/orders/${paymentResult.order_id}`
      );

      if (
        confirmedOrder?.payment_status !== "paid" ||
        confirmedOrder?.order_status !== "confirmed"
      ) {
        throw userFacingError(
          "Payment was found, but the order still needs confirmation. Please don't pay again."
        );
      }

      confirmRef.current = null;
      pendingOrderRef.current = null;
      pendingPaymentRef.current = null;
      pendingIdempotencyRef.current = null;
      clearCheckoutAttempt();

      try {
        await refreshCounts();
      } catch {
        // The order is already confirmed.
      }

      navigate("/order-success", {
        state: {
          order: confirmedOrder,
          payment: paymentResult,
        },
      });
    } catch (requestError) {
      setPaymentConfirmedFailed(false);
      setPaymentNeedsSupport(
        requestError?.response?.status === 409
      );
      setError(
        getErrorMessage(
          requestError,
          "Unable to verify payment status. Please don't pay again."
        )
      );
    } finally {
      confirmingRef.current = false;

      if (mountedRef.current) {
        setConfirming(false);
      }
    }
  };


  const retryPendingPayment = async () => {
    if (busyRef.current || confirmingRef.current) return;

    const savedOrder = pendingOrderRef.current;
    const savedPayment = pendingPaymentRef.current?.payment;

    if (!savedOrder?.order?.id || !savedPayment?.id) {
      setError(
        "The saved order details are unavailable. Check My Orders before trying to pay again."
      );
      return;
    }

    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;

    if (!razorpayKey) {
      setError("Online payments are not configured right now.");
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError("");

    try {
      const loaded = await loadRazorpay();

      if (!loaded) {
        throw userFacingError(
          "Unable to load Razorpay Checkout. Please try again."
        );
      }

      const { data: payment } = await api.post("/payments/retry", {
        payment_id: savedPayment.id,
      });

      const order = savedOrder.order;

      if (payment.status === "paid") {
        pendingPaymentRef.current = {
          key: `${order.id}|${savedOrder.key}`,
          payment,
        };

        setPaymentConfirmedFailed(false);
        releaseBusy();
        await checkPaymentStatus();
        return;
      }

      if (
        payment.status !== "pending" ||
        !payment.gateway_order_id
      ) {
        throw userFacingError(
          "The payment is not ready to retry. Check its status before trying again."
        );
      }

      pendingPaymentRef.current = {
        key: `${order.id}|${savedOrder.key}`,
        payment,
      };

      savePendingPayment({
        userId: user?.id,
        orderId: order.id,
        orderNumber: order.order_number,
        paymentId: payment.id,
        gatewayOrderId: payment.gateway_order_id,
        amount: payment.amount,
        currency: payment.currency,
        orderKey: savedOrder.key,
        idempotencyKey: savedOrder.idempotencyKey ?? null,
      });

      setPaymentConfirmedFailed(false);
      setPaymentPending(order.order_number);

      let paymentReported = false;

      const razorpay = new window.Razorpay({
        key: razorpayKey,
        amount: Math.round(Number(payment.amount) * 100),
        currency: payment.currency,
        name: siteName,
        description: `Order ${order.order_number}`,
        order_id: payment.gateway_order_id,

        prefill: {
          name: [user?.first_name, user?.last_name]
            .filter(Boolean)
            .join(" "),
          email: user?.email || "",
          contact: user?.phone_number || "",
        },

        theme: { color: "#2874F0" },

        handler: (response) => {
          paymentReported = true;
          paymentLockedRef.current = true;
          confirmRef.current = { order, payment, response };
          confirmPayment();
        },

        modal: {
          ondismiss: async () => {
            if (paymentReported) return;

            let confirmedFailed = false;

            try {
              const { data } = await api.post("/payments/fail", {
                payment_id: payment.id,
              });
              confirmedFailed = data?.status === "failed";
            } catch {
              // Keep the existing order when the gateway outcome
              // cannot be confirmed.
            }

            setPaymentConfirmedFailed(confirmedFailed);
            setPaymentPending(order.order_number);
            setError(
              confirmedFailed
                ? "Razorpay confirmed the payment attempt failed. You can retry this existing order."
                : "The payment outcome is still unresolved. Check payment status before trying again."
            );

            releaseBusy();
          },
        },
      });

      razorpay.on("payment.failed", () => {
        setPaymentConfirmedFailed(false);
        setPaymentNeedsSupport(false);

        setError(
          "Razorpay reported an unsuccessful attempt. We'll verify its final status before allowing another attempt."
        );
      });

      razorpay.open();
      } catch (error) {
      setPaymentConfirmedFailed(false);
      setPaymentNeedsSupport(
        error?.response?.status === 409
      );

      setError(
        getErrorMessage(
          error,
          "Unable to retry payment. Please check its status."
        )
      );

      releaseBusy();
    }
  };


  const placeOrder = async () => {
    if (
      busyRef.current ||
      confirmingRef.current ||
      paymentLockedRef.current ||
      couponLoadingRef.current ||
      contactSaving
    ) {
      return;
    }

    if (editingContact) {
      setError("Save or cancel your contact change first.");
      setStep(1);
      return;
    }

    if (!selectedAddress) {
      setError("Select a delivery address.");
      setStep(1);
      return;
    }

    if (!hasPhone) {
      setError(
        "Add a phone number so we can deliver your order.",
      );
      setStep(1);
      return;
    }

    if (paymentMethod === "cod" && !confirmedCod) {
      setError(
        "Confirm that you will pay for the order on delivery.",
      );
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setError("");

    try {

      const razorpayKey =
        paymentMethod === "upi"
          ? import.meta.env.VITE_RAZORPAY_KEY_ID
          : null;

      if (paymentMethod === "upi") {
        if (!razorpayKey) {
          throw userFacingError(
            "Online payments are not available right now. Please choose Cash on Delivery or try again later.",
          );
        }

        const razorpayLoaded = await loadRazorpay();

        if (!razorpayLoaded) {
          throw userFacingError(
            "Unable to load Razorpay Checkout. Please try again.",
          );
        }
      }

      const cartItemsKey = (cart?.items || [])
        .map((item) => [
          item.product_id ?? item.product?.id ?? "",
          item.quantity ?? "",
        ])
        .sort((a, b) =>
          String(a[0]).localeCompare(String(b[0])),
        );

      const orderKey = JSON.stringify({
        userId: user?.id ?? "",
        addressId: selectedAddress.id,
        couponCode: appliedCoupon?.code || "",
        paymentMethod,
        subtotal: cart?.subtotal ?? "",
        items: cartItemsKey,
      });


      let order;

      if (pendingOrderRef.current?.key === orderKey) {
        order = pendingOrderRef.current.order;
      } else {
        let data;
        let idempotencyKey;

        try {    

          if (
            pendingIdempotencyRef.current?.orderKey === orderKey
          ) {
            idempotencyKey =
              pendingIdempotencyRef.current.idempotencyKey;
          } else {
            const savedAttempt = readCheckoutAttempt();

            if (
              savedAttempt?.orderKey === orderKey &&
              String(savedAttempt.userId) === String(user?.id)
            ) {
              idempotencyKey = savedAttempt.idempotencyKey;
            } else {
              idempotencyKey = crypto.randomUUID();
            }

            const attempt = {
              userId: user?.id,
              orderKey,
              idempotencyKey,
            };

            pendingIdempotencyRef.current = attempt;
            saveCheckoutAttempt(attempt);
          }

          ({ data } = await api.post("/orders/", {
            shipping_address_id: selectedAddress.id,
            coupon_code: appliedCoupon?.code || null,
            payment_method: paymentMethod,
            idempotency_key: idempotencyKey,
          }));

        } catch (orderError) {
          if (
            REFRESH_CART_STATUSES.includes(
              orderError.response?.status,
            )
          ) {
            refreshCart();
          }

          throw orderError;
        }

        order = data;

        pendingOrderRef.current = {
          key: orderKey,
          order,
          idempotencyKey,
        };

        pendingPaymentRef.current = null;
      }

      if (paymentMethod === "cod") {
        pendingOrderRef.current = null;
        pendingPaymentRef.current = null;

        try {
          await refreshCounts();
        } catch {
          // The order is placed. wont create a duplicate order.
        }
        pendingIdempotencyRef.current = null;
        clearCheckoutAttempt();

        navigate("/order-success", {
          state: { order },
        });

        return;
      }

      const paymentKey = [order.id, orderKey].join("|");

      let payment;

      if (
        pendingPaymentRef.current?.key === paymentKey &&
        pendingPaymentRef.current.payment
      ) {
        payment = pendingPaymentRef.current.payment;
      } else {
        const { data } = await api.post("/payments/", {
          order_id: order.id,
        });

        payment = data;

        pendingPaymentRef.current = {
          key: paymentKey,
          payment,
        };
      }
      savePendingPayment({
        userId: user?.id,
        orderId: order.id,
        orderNumber: order.order_number,
        paymentId: payment.id,
        gatewayOrderId: payment.gateway_order_id,
        amount: payment.amount,
        currency: payment.currency,
        orderKey,
        idempotencyKey:
          pendingIdempotencyRef.current?.idempotencyKey ??
          readCheckoutAttempt()?.idempotencyKey ??
          null,
      });
      let paymentReported = false;

      const razorpayOptions = {
        key: razorpayKey,
        amount: Math.round(Number(payment.amount) * 100),
        currency: payment.currency,

        name: siteName,
        description: `Order ${order.order_number}`,
        order_id: payment.gateway_order_id,

        prefill: {
          name: [user?.first_name, user?.last_name]
            .filter(Boolean)
            .join(" "),
          email: user?.email || "",
          contact: user?.phone_number || "",
        },

        theme: {
          color: "#2874F0",
        },

        handler: (response) => {
          paymentReported = true;
          paymentLockedRef.current = true;

          confirmRef.current = { order, payment, response };

          confirmPayment();
        },

        
        modal: {
          ondismiss: async () => {
            if (paymentReported) {
              return;
            }

            let confirmedFailed = false;

            try {
              const { data: failedPayment } = await api.post(
                "/payments/fail",
                {
                  payment_id: payment.id,
                },
              );

              confirmedFailed = failedPayment?.status === "failed";
            } catch {
              // The server may be unable to confirm failure yet.
              // Keep the existing order and payment for a safe retry.
            }

            if (confirmedFailed) {
              setPaymentConfirmedFailed(true);
              setPaymentPending(order.order_number);

              setError(
                "Razorpay confirmed that all payment attempts failed. Your existing order is saved so you can retry payment safely."
              );
            } else {
              setPaymentConfirmedFailed(false);
              setPaymentPending(order.order_number);

              setError(
                "Payment window closed. The final status is not confirmed yet. Your existing order is saved. Check its status before trying again."
              );
            }

            releaseBusy();
          },
        },

      };

      const razorpay = new window.Razorpay(razorpayOptions);

      razorpay.on("payment.failed", () => {
        setError(
          "Payment failed. You can try again in the payment window.",
        );
      });

      razorpay.open();
    } catch (requestError) {
      setError(
        requestError.isUserFacing
          ? requestError.message
          : getErrorMessage(
              requestError,
              "We couldn't place your order. Please try again.",
            ),
      );

      releaseBusy();
    }
  };

  const loading = authLoading || (isAuthenticated && !loaded);

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
          <div className="rounded-md border border-[#E0E0E0] bg-white px-6 py-16 text-center">
            <h1 className="text-2xl font-bold text-[#212121]">
              Sign in to check out
            </h1>

            <p className="mx-auto mt-2 max-w-md text-sm text-[#878787]">
              Your cart and delivery details are linked to your
              account.
            </p>

            <Link
              to="/login"
              state={{ from: location }}
              className="mt-6 inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
            >
              Sign in
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error && !cart) {
    return (
      <div className="min-h-screen bg-[#F1F3F6] px-6 py-20">
        <SEO
          title="Checkout"
          description={`Complete your ${siteName} order securely.`}
          noIndex
        />

        <div className="mx-auto max-w-4xl">
          <div
            role="alert"
            className="rounded-md border border-[#F2C7C2] bg-[#FFF1EF] px-4 py-3 text-sm text-[#C62828]"
          >
            {error}
          </div>

          <button
            type="button"
            onClick={() => {
              setError("");
              setLoaded(false);
              setReloadKey((key) => key + 1);
            }}
            className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-6 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6]"
          >
            Try again
          </button>
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

  const payDisabled =
    busy ||
    confirming ||
    contactSaving ||
    couponLoading ||
    !selected ||
    (paymentMethod === "cod" && !confirmedCod);

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
                    step >= 1 ? "text-[#212121]" : "text-[#878787]"
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
                    step >= 2 ? "text-[#212121]" : "text-[#878787]"
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
              ref={errorRef}
              role="alert"
              className="mb-5 rounded-md border border-[#F2C7C2] bg-[#FFF1EF] px-4 py-3 text-sm text-[#C62828]"
            >
              {error}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[1fr_390px]">
            {/* LEFT */}
            <div className="space-y-5">
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
                              String(address.id) === String(selected);

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
                                      setSelected(event.target.value)
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
                                      {address.city}, {address.state}{" "}
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
                                <label
                                  htmlFor="checkout-phone"
                                  className="text-xs font-semibold uppercase tracking-wide text-[#878787]"
                                >
                                  Phone number
                                </label>

                                <input
                                  id="checkout-phone"
                                  type="tel"
                                  inputMode="tel"
                                  value={contactValue}
                                  onChange={(event) => {
                                    setContactValue(event.target.value);
                                    setError("");
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      saveContact();
                                    }
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
                                  {user?.phone_number ||
                                    "Phone number not added"}
                                </p>

                                {!hasPhone && (
                                  <p className="mt-1 text-xs text-[#C62828]">
                                    Required for delivery
                                  </p>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => startContactEdit("phone")}
                              className="shrink-0 cursor-pointer text-sm font-semibold text-[#2874F0] hover:underline"
                            >
                              {hasPhone ? "Edit" : "Add"}
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
                                <label
                                  htmlFor="checkout-email"
                                  className="text-xs font-semibold uppercase tracking-wide text-[#878787]"
                                >
                                  Email address
                                </label>

                                <input
                                  id="checkout-email"
                                  type="email"
                                  value={contactValue}
                                  onChange={(event) => {
                                    setContactValue(event.target.value);
                                    setError("");
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      saveContact();
                                    }
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
                      disabled={
                        !selected || Boolean(editingContact) || !hasPhone
                      }
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

                  {addresses.length > 0 && (editingContact || !hasPhone) && (
                    <p className="-mt-2 text-center text-xs text-[#878787]">
                      {editingContact
                        ? "Save or cancel your contact change to continue."
                        : "Add a phone number to continue."}
                    </p>
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
                        disabled={locked}
                        className="cursor-pointer text-sm font-semibold text-[#2874F0] disabled:cursor-not-allowed disabled:opacity-50"
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
                        <Phone size={17} className="text-[#2874F0]" />

                        <div className="min-w-0">
                          <p className="text-xs text-[#878787]">Phone</p>

                          <p className="break-words text-sm font-semibold text-[#212121]">
                            {user?.phone_number || "Phone number not added"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Mail size={17} className="text-[#2874F0]" />

                        <div className="min-w-0">
                          <p className="text-xs text-[#878787]">Email</p>

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
                        ].map(([value, label]) => (
                          <label
                            key={value}
                            className={`flex cursor-pointer items-center justify-between rounded-md border p-4 ${
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
                                disabled={locked}
                                checked={paymentMethod === value}
                                onChange={() => {
                                  setPaymentMethod(value);
                                  setError("");
                                }}
                                className="cursor-pointer disabled:cursor-not-allowed"
                              />

                              <span className="text-sm font-semibold text-[#212121]">
                                {label}
                              </span>
                            </div>
                          </label>
                        ))}
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
                                Pay the final order amount when your order
                                is delivered.
                              </p>

                              <label className="mt-3 flex cursor-pointer items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={confirmedCod}
                                  disabled={locked}
                                  onChange={(event) =>
                                    setConfirmedCod(event.target.checked)
                                  }
                                  className="mt-0.5 cursor-pointer"
                                />

                                <span className="text-sm text-[#444]">
                                  I'll pay the order total when it is
                                  delivered.
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
                            disabled={locked}
                            className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-bold text-[#2874F0] hover:text-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
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
                              <strong>{formatINR(couponDiscount)}</strong>
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={removeCoupon}
                            disabled={locked}
                            className="cursor-pointer text-sm font-semibold text-[#2874F0] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              aria-label="Coupon code"
                              value={coupon}
                              disabled={locked}
                              onChange={(event) => {
                                setCoupon(event.target.value.toUpperCase());
                                setCouponError("");
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  applyCoupon();
                                }
                              }}
                              placeholder="Enter coupon code"
                              className="h-12 flex-1 rounded-md border border-[#D0D0D0] px-4 text-sm uppercase outline-none transition focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0] disabled:opacity-50"
                            />

                            <button
                              type="button"
                              onClick={() => applyCoupon()}
                              disabled={
                                locked || couponLoading || !coupon.trim()
                              }
                              className="h-12 cursor-pointer rounded-md border border-[#2874F0] px-7 text-sm font-bold text-[#2874F0] transition hover:bg-[#F5F9FF] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {couponLoading ? "Applying..." : "Apply"}
                            </button>
                          </div>

                          {couponError && !couponsOpen && (
                            <p
                              role="alert"
                              className="mt-2 text-sm text-[#C62828]"
                            >
                              {couponError}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>

            {/* RIGHT: ORDER SUMMARY */}
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

                      {Number(item.discount_amount || 0) > 0 ? (
                        <div className="shrink-0 text-right">
                          <Price value={item.discounted_line_total} className="block text-sm font-semibold text-[#388E3C]" />
                          <Price value={item.line_total} className="block text-xs text-[#878787] line-through" />
                        </div>
                      ) : (
                        <Price
                          value={item.line_total}
                          className="shrink-0 text-sm font-semibold"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <div className="my-5 border-t border-[#E0E0E0]" />

                {/* PRICE BREAKDOWN */}
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#555]">Subtotal</span>

                    <Price value={subtotal} />
                  </div>

                  {dealDiscountTotal > 0 && (
                    <div className="flex justify-between text-[#388E3C]">
                      <span>Offer discount</span>
                      <span className="font-semibold">- {formatINR(dealDiscountTotal)}</span>
                    </div>
                  )}

                  {appliedCoupon && (
                    <div className="flex justify-between text-[#388E3C]">
                      <span>Coupon discount</span>

                      <span className="font-semibold">
                        - {formatINR(couponDiscount)}
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
                    Estimated total
                  </span>

                  <span className="text-xl font-bold text-[#212121]">
                    {formatINR(estimatedTotal)}
                  </span>
                </div>

                <p className="mt-2 text-xs text-[#878787]">
                  The final amount, discounts and stock are verified when
                  the order is placed.
                </p>

                {/* PAYMENT RECEIVED BUT NOT CONFIRMED */}
                {step === 2 && paymentPending && (
                  <div className="mt-5 rounded-md border border-[#FFE0A3] bg-[#FFF8E6] p-4">
                    <p className="text-sm font-semibold text-[#7A5200]">
                      {paymentNeedsSupport
                        ? `Payment requires support for order ${paymentPending}`
                        : paymentConfirmedFailed
                          ? `Payment attempt failed for order ${paymentPending}`
                          : `Payment status for order ${paymentPending}`}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#7A5200]">
                      {paymentNeedsSupport
                        ? "We couldn't safely reconcile this payment with your order. Please don't pay again. Contact support before taking any further payment action."
                        : paymentConfirmedFailed
                          ? "The payment attempt failed. Your existing order is saved for a safe retry."
                          : "We're still confirming the payment. Please don't pay again yet."}
                    </p>

                    <button
                      type="button"
                      onClick={retryPendingPayment}
                      disabled={busy || confirming || !paymentConfirmedFailed}
                      className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#2874F0] px-5 py-3 text-sm font-bold text-[#2874F0] transition hover:bg-[#F5F9FF] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? "Opening Razorpay..." : "Retry UPI Payment"}
                    </button>

                    <button
                      type="button"
                      onClick={checkPaymentStatus}
                      disabled={confirming}
                      className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-5 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {confirming ? "Checking..." : "Check payment status"}
                    </button>

                      {paymentNeedsSupport && (
                        <Link
                          to={`/contact?order=${encodeURIComponent(paymentPending)}`}
                          className="mt-3 flex w-full items-center justify-center rounded-md border border-[#2874F0] px-5 py-3 text-sm font-bold text-[#2874F0] transition hover:bg-[#F5F9FF]"
                        >
                          Contact support about this order
                        </Link>
                      )}

                    <Link
                      to="/orders"
                      className="mt-2 block text-center text-sm font-semibold text-[#2874F0] hover:underline"
                    >
                      View my orders
                    </Link>
                  </div>
                )}

                {/* PLACE ORDER */}
                {step === 2 && !paymentPending && (
                  <button
                    type="button"
                    disabled={payDisabled}
                    onClick={placeOrder}
                    className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-5 py-3.5 text-sm font-bold !text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? (
                      paymentMethod === "cod"
                        ? "Placing order..."
                        : "Processing..."
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
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-dialog-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
          >
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-[#E0E0E0] px-5 py-4">
              <div>
                <h2
                  id="coupon-dialog-title"
                  className="text-lg font-bold text-[#212121]"
                >
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
                autoFocus
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#555] transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* MODAL CONTENT */}
            <div className="overflow-y-auto p-5">
              {couponError && (
                <div
                  role="alert"
                  className="mb-4 flex items-center justify-between gap-3 rounded-md border border-[#F2C7C2] bg-[#FFF1EF] px-4 py-3 text-sm text-[#C62828]"
                >
                  <span>{couponError}</span>

                  {availableCoupons.length === 0 && !couponsLoading && (
                    <button
                      type="button"
                      onClick={openCoupons}
                      className="shrink-0 cursor-pointer font-semibold text-[#2874F0] hover:underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}

              {couponsLoading ? (
                <div className="py-12">
                  <LoadingState />
                </div>
              ) : availableCoupons.length === 0 ? (
                !couponError && (
                  <div className="rounded-md border border-dashed border-[#D0D0D0] px-5 py-12 text-center">
                    <TicketPercent
                      size={38}
                      className="mx-auto text-[#878787]"
                    />

                    <h3 className="mt-4 font-bold text-[#212121]">
                      No coupons available
                    </h3>

                    <p className="mt-1 text-sm text-[#878787]">
                      There are no active coupons available for this
                      account right now.
                    </p>
                  </div>
                )
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
                              : `${formatINR(item.value)} off`}
                          </p>

                          {Number(item.minimum_order_amount || 0) > 0 && (
                            <p className="mt-1 text-xs text-[#878787]">
                              Minimum order:{" "}
                              {formatINR(item.minimum_order_amount)}
                            </p>
                          )}

                          {item.maximum_discount &&
                            item.discount_type === "percentage" && (
                              <p className="mt-1 text-xs text-[#878787]">
                                Maximum discount:{" "}
                                {formatINR(item.maximum_discount)}
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
                          disabled={!item.eligible || couponLoading}
                          onClick={() => handleCouponSelect(item)}
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
function Checkout() {
  const { user } = useAuth();

  return <CheckoutContent key={user?.id ?? "guest"} />;
}

export default Checkout;