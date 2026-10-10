import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Edit3,
  MapPin,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import api from "../services/api";
import useAuth from "../context/useAuth";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";
import { EmptyState, LoadingState } from "../components/Storefront";

const NETWORK_ERROR = "Network problem. Check your connection and try again.";

const DEFAULT_COUNTRY = "India";
const INDIA_PIN_PATTERN = /^[1-9]\d{5}$/;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2874F0] focus-visible:ring-offset-2";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const EMPTY_FORM = {
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country: DEFAULT_COUNTRY,
  is_default: false,
};

const FIELDS = [
  {
    name: "address_line1",
    label: "Address line 1",
    autoComplete: "address-line1",
    maxLength: 255,
    placeholder: "House / flat / building",
    wide: true,
  },
  {
    name: "address_line2",
    label: "Address line 2",
    optional: true,
    autoComplete: "address-line2",
    maxLength: 255,
    placeholder: "Street, area, landmark",
    wide: true,
  },
  {
    name: "city",
    label: "City",
    autoComplete: "address-level2",
    maxLength: 100,
  },
  {
    name: "state",
    label: "State",
    autoComplete: "address-level1",
    maxLength: 100,
  },
  {
    name: "postal_code",
    label: "Postal code",
    autoComplete: "postal-code",
    maxLength: 10,
    inputMode: "numeric",
    placeholder: "6-digit PIN code",
  },
  {
    name: "country",
    label: "Country",
    autoComplete: "country-name",
    maxLength: 100,
    readOnly: true,
  },
];

const FIELD_ORDER = FIELDS.map((field) => field.name);
const BACKEND_FIELDS = [
  "address_line1",
  "address_line2",
  "city",
  "state",
  "postal_code",
  "country",
];

const getErrorMessage = (error, fallback) => {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;

  if (status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.msg) return String(item.msg).replace(/^Value error,\s*/i, "");
        return "";
      })
      .filter(Boolean);

    if (messages.length) return messages.join(" ");
  }

  if (typeof detail === "string" && detail.trim()) return detail;

  if (error?.response) return fallback;
  if (error?.request) return NETWORK_ERROR;

  return fallback;
};

const mapBackendFieldErrors = (detail) => {
  const mapped = {};

  if (!Array.isArray(detail)) return mapped;

  detail.forEach((item) => {
    const loc = Array.isArray(item?.loc) ? item.loc : [];
    const field = loc[loc.length - 1];

    if (!BACKEND_FIELDS.includes(field) || mapped[field]) return;

    const message = item?.msg
      ? String(item.msg).replace(/^Value error,\s*/i, "")
      : "";

    if (message) mapped[field] = message;
  });

  return mapped;
};

const isIndia = (country) =>
  String(country || "").trim().toLowerCase() === DEFAULT_COUNTRY.toLowerCase();

const validate = (values) => {
  const errors = {};

  const line1 = values.address_line1.trim();
  const line2 = values.address_line2.trim();
  const city = values.city.trim();
  const state = values.state.trim();
  const postal = values.postal_code.replace(/\s+/g, "");

  if (!line1) errors.address_line1 = "Address line 1 is required.";
  else if (line1.length > 255) errors.address_line1 = "Address line 1 is too long.";

  if (line2.length > 255) errors.address_line2 = "Address line 2 is too long.";

  if (!city) errors.city = "City is required.";
  else if (city.length > 100) errors.city = "City name is too long.";

  if (!state) errors.state = "State is required.";
  else if (state.length > 100) errors.state = "State name is too long.";

  if (!postal) {
    errors.postal_code = "Postal code is required.";
  } else if (isIndia(values.country)) {
    if (!INDIA_PIN_PATTERN.test(postal)) {
      errors.postal_code = "Enter a valid 6-digit PIN code.";
    }
  } else if (postal.length > 10) {
    errors.postal_code = "Postal code is too long.";
  }

  return errors;
};

const toPayload = (values) => ({
  address_line1: values.address_line1.trim(),
  address_line2: values.address_line2.trim() || null,
  city: values.city.trim(),
  state: values.state.trim(),
  postal_code: values.postal_code.replace(/\s+/g, ""),
  country: values.country.trim() || DEFAULT_COUNTRY,
  is_default: Boolean(values.is_default),
});

function Modal({
  labelledBy,
  dismissible,
  onRequestClose,
  widthClass = "max-w-2xl",
  children,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onRequestClose);
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    closeRef.current = onRequestClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const target = dialog?.querySelector("[data-autofocus]") || dialog;
    target?.focus();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (dismissibleRef.current) {
          event.stopPropagation();
          closeRef.current?.();
        }
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll(FOCUSABLE));

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) {
          onRequestClose?.();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`max-h-[90vh] w-full ${widthClass} overflow-y-auto border border-[#E0E0E0] bg-white shadow-2xl outline-none`}
      >
        {children}
      </div>
    </div>
  );
}

function Addresses() {
  const { isAuthenticated } = useAuth();

  const branding = useContext(SiteBrandingContext) || {};
  const { siteName = "TerraLens" } = branding;

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [initialForm, setInitialForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [defaultingId, setDefaultingId] = useState(null);

  const mountedRef = useRef(false);
  const loadedOnceRef = useRef(false);
  const focusTargetRef = useRef(null);
  const keepEditingRef = useRef(null);
  const noticeTimerRef = useRef(null);
  const pageErrorRef = useRef(null);
  const submittingRef = useRef(false);
  const deletingRef = useRef(false);
  const defaultingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;

    const load = async () => {
      try {
        const response = await api.get("/addresses/");

        if (cancelled) return;

        setAddresses(Array.isArray(response.data) ? response.data : []);
        setLoadError("");
        loadedOnceRef.current = true;
      } catch (requestError) {
        if (cancelled) return;

        const message = getErrorMessage(
          requestError,
          "Unable to load your addresses.",
        );

        if (loadedOnceRef.current) setPageError(message);
        else setLoadError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, reloadKey]);

  const refresh = () => setReloadKey((key) => key + 1);

  const retryLoad = () => {
    setLoading(true);
    setLoadError("");
    refresh();
  };

  useEffect(() => {
    if (!pageError || !pageErrorRef.current) return;

    pageErrorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pageError]);

  useEffect(() => {
    if (busy || !focusTargetRef.current) return;

    const el = document.getElementById(`address-${focusTargetRef.current}`);
    focusTargetRef.current = null;

    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }, [busy, fieldErrors]);

  const showNotice = (message) => {
    setNotice(message);

    clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setNotice("");
    }, 4000);
  };


  const openForm = (address) => {
    const nextForm = address
      ? {
          address_line1: address.address_line1 || "",
          address_line2: address.address_line2 || "",
          city: address.city || "",
          state: address.state || "",
          postal_code: address.postal_code || "",
          country: address.country || DEFAULT_COUNTRY,
          is_default: Boolean(address.is_default),
        }
      : { ...EMPTY_FORM, is_default: addresses.length === 0 };

    setInitialForm(nextForm);

    setEditing(address || null);
    setForm(nextForm);
    setFieldErrors({});
    setFormError("");
    setPageError("");
    setConfirmDeleteId(null);
    setConfirmDiscard(false);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (submittingRef.current) return;

    setFormOpen(false);
    setEditing(null);
    setFieldErrors({});
    setFormError("");
    setConfirmDiscard(false);
  };

  const formDirty = Object.keys(EMPTY_FORM).some(
    (key) => form[key] !== initialForm[key],
  );

  const requestClose = () => {
    if (submittingRef.current) return;

    if (formDirty) {
      setConfirmDiscard(true);
      return;
    }

    closeForm();
  };

  useEffect(() => {
    if (confirmDiscard) keepEditingRef.current?.focus();
  }, [confirmDiscard]);

  const change = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));

    setFieldErrors((current) => {
      if (!current[name]) return current;

      const next = { ...current };
      delete next[name];
      return next;
    });

    if (formError) setFormError("");
  };

  const firstInvalid = (errors) =>
    FIELD_ORDER.find((name) => errors[name]) || null;

  const submit = async (event) => {
    event.preventDefault();

    if (submittingRef.current) return;

    setFormError("");

    const errors = validate(form);

    if (Object.keys(errors).length > 0) {
      focusTargetRef.current = firstInvalid(errors);
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    submittingRef.current = true;
    setBusy(true);

    try {
      const payload = toPayload(form);

      if (editing) {
        await api.put(`/addresses/${editing.id}`, payload);
      } else {
        await api.post("/addresses/", payload);
      }

      if (!mountedRef.current) return;

      setFormOpen(false);
      setEditing(null);
      showNotice(editing ? "Address updated." : "Address saved.");
      refresh();
    } catch (requestError) {
      if (!mountedRef.current) return;

      const mapped = mapBackendFieldErrors(requestError?.response?.data?.detail);

      if (Object.keys(mapped).length > 0) {
        focusTargetRef.current = firstInvalid(mapped);
        setFieldErrors(mapped);
      } else {
        setFormError(
          getErrorMessage(requestError, "Unable to save this address."),
        );
      }
    } finally {
      submittingRef.current = false;

      if (mountedRef.current) setBusy(false);
    }
  };

  const removeAddress = async (address) => {
    if (deletingRef.current) return;

    deletingRef.current = true;
    setDeletingId(address.id);
    setPageError("");

    try {
      await api.delete(`/addresses/${address.id}`);

      if (!mountedRef.current) return;

      setConfirmDeleteId(null);
      showNotice("Address deleted.");
      refresh();
    } catch (requestError) {
      if (!mountedRef.current) return;

      setConfirmDeleteId(null);
      setPageError(
        getErrorMessage(requestError, "Unable to delete this address."),
      );
    } finally {
      deletingRef.current = false;

      if (mountedRef.current) setDeletingId(null);
    }
  };

  const makeDefault = async (address) => {
    if (defaultingRef.current) return;

    defaultingRef.current = true;
    setDefaultingId(address.id);
    setPageError("");

    try {
      await api.put(
        `/addresses/${address.id}`,
        toPayload({
          address_line1: address.address_line1 || "",
          address_line2: address.address_line2 || "",
          city: address.city || "",
          state: address.state || "",
          postal_code: address.postal_code || "",
          country: address.country || DEFAULT_COUNTRY,
          is_default: true,
        }),
      );

      if (!mountedRef.current) return;

      showNotice("Default address updated.");
      refresh();
    } catch (requestError) {
      if (!mountedRef.current) return;

      setPageError(
        getErrorMessage(requestError, "Unable to update your default address."),
      );
    } finally {
      defaultingRef.current = false;

      if (mountedRef.current) setDefaultingId(null);
    }
  };

  const seo = (
    <SEO
      title="Addresses"
      description={`Manage your saved delivery addresses on ${siteName}.`}
      noIndex
    />
  );

  if (!isAuthenticated) {
    return (
      <>
        {seo}

        <div className="min-h-screen bg-[#F1F3F6] px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <EmptyState
              title="Sign in to manage your addresses"
              text="Save delivery addresses for faster checkout."
              action="Sign in"
              to="/login"
            />
          </div>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        {seo}

        <div className="min-h-screen bg-[#F1F3F6] px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <LoadingState />
          </div>
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        {seo}

        <div className="min-h-screen bg-[#F1F3F6] px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-4xl border border-[#E0E0E0] bg-white px-6 py-14 text-center">
            <h1 className="text-xl font-bold text-[#212121]">
              Addresses unavailable
            </h1>

            <p role="alert" className="mt-2 text-sm text-[#878787]">
              {loadError}
            </p>

            <button
              type="button"
              onClick={retryLoad}
              className={`mt-6 inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#1f65d6] ${FOCUS_RING}`}
            >
              <RotateCcw size={15} aria-hidden="true" />
              Try again
            </button>
          </div>
        </div>
      </>
    );
  }

  const sortedAddresses = [...addresses].sort(
    (a, b) => Number(Boolean(b.is_default)) - Number(Boolean(a.is_default)),
  );

  const isFirstAddress = !editing && addresses.length === 0;
  const lockDefault = isFirstAddress || Boolean(editing?.is_default);

  return (
    <>
      {seo}

      <div className="min-h-screen bg-[#F1F3F6] px-4 py-7 pb-14 sm:px-6 sm:py-9">
        <div className="mx-auto max-w-7xl">
          {/* HEADER */}
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2874F0]">
                Delivery Details
              </p>

              <h1 className="mt-1 text-2xl font-bold text-[#212121] sm:text-3xl">
                Saved Addresses
              </h1>

              <p className="mt-1 text-sm text-[#878787]">
                Manage your delivery addresses for faster checkout.
              </p>
            </div>

            <button
              type="button"
              onClick={() => openForm(null)}
              className={`inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-6 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6] ${FOCUS_RING}`}
            >
              <Plus size={17} aria-hidden="true" />
              Add address
            </button>
          </div>

          {/* SUCCESS NOTICE (announced to screen readers) */}
          <div role="status" aria-live="polite">
            {notice && (
              <div className="mb-5 border border-[#C8E6C9] bg-[#F1F8F2] px-5 py-3 text-sm font-medium text-[#2E7D32]">
                {notice}
              </div>
            )}
          </div>

          {/* PAGE ERROR */}
          {pageError && (
            <div
              ref={pageErrorRef}
              role="alert"
              className="mb-5 border border-[#FFCDD2] bg-[#FFEBEE] px-5 py-4 text-sm text-[#D32F2F]"
            >
              {pageError}
            </div>
          )}

          {/* ADDRESS LIST */}
          {sortedAddresses.length === 0 ? (
            <div className="border border-[#E0E0E0] bg-white">
              <div className="px-6 py-16 text-center sm:py-20">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#F1F3F6] text-[#2874F0]">
                  <MapPin size={32} aria-hidden="true" />
                </div>

                <h2 className="mt-6 text-xl font-bold text-[#212121]">
                  No saved addresses
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm text-[#878787]">
                  Add a delivery address to make your checkout faster.
                </p>

                <button
                  type="button"
                  onClick={() => openForm(null)}
                  className={`mt-6 inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6] ${FOCUS_RING}`}
                >
                  <Plus size={17} aria-hidden="true" />
                  Add your first address
                </button>
              </div>
            </div>
          ) : (
            <>
              <section
                aria-labelledby="addresses-heading"
                className="border border-[#E0E0E0] bg-white"
              >
                <div className="flex items-center justify-between border-b border-[#E0E0E0] px-5 py-4">
                  <div>
                    <h2
                      id="addresses-heading"
                      className="text-base font-bold text-[#212121]"
                    >
                      Delivery Addresses
                    </h2>

                    <p className="mt-1 text-xs text-[#878787]">
                      {sortedAddresses.length}{" "}
                      {sortedAddresses.length === 1
                        ? "saved address"
                        : "saved addresses"}
                    </p>
                  </div>

                  <MapPin
                    size={19}
                    className="text-[#2874F0]"
                    aria-hidden="true"
                  />
                </div>

                <div className="grid gap-4 p-5 md:grid-cols-2">
                  {sortedAddresses.map((address) => {
                    const cityLine = [address.city, address.state]
                      .filter(Boolean)
                      .join(", ");
                    const isDeleting = deletingId === address.id;
                    const isDefaulting = defaultingId === address.id;
                    const confirming = confirmDeleteId === address.id;

                    return (
                      <article
                        key={address.id}
                        className={`flex flex-col border bg-white transition ${
                          address.is_default
                            ? "border-[#2874F0]"
                            : "border-[#E0E0E0] hover:border-[#BDBDBD]"
                        }`}
                      >
                        {/* HEADER */}
                        <div className="flex items-start justify-between border-b border-[#E0E0E0] px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
                              <MapPin size={17} aria-hidden="true" />
                            </div>

                            <div>
                              <p className="text-sm font-bold text-[#212121]">
                                Delivery Address
                              </p>

                              <p className="mt-0.5 text-xs text-[#878787]">
                                Saved address
                              </p>
                            </div>
                          </div>

                          {address.is_default && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-3 py-1 text-[11px] font-bold text-[#388E3C]">
                              <Check size={12} aria-hidden="true" />
                              Default
                            </span>
                          )}
                        </div>

                        {/* ADDRESS */}
                        <div className="min-w-0 flex-1 break-words px-4 py-5">
                          <p className="font-bold text-[#212121]">
                            {address.address_line1}
                          </p>

                          {address.address_line2 && (
                            <p className="mt-1 text-sm text-[#555]">
                              {address.address_line2}
                            </p>
                          )}

                          <p className="mt-2 text-sm leading-6 text-[#555]">
                            {cityLine}
                            {address.postal_code ? ` ${address.postal_code}` : ""}
                          </p>

                          {address.country && (
                            <p className="mt-1 text-sm text-[#878787]">
                              {address.country}
                            </p>
                          )}
                        </div>

                        {/* ACTIONS */}
                        <div className="border-t border-[#E0E0E0] px-4 py-3">
                          {confirming ? (
                            <div>
                              <p className="text-sm font-semibold text-[#212121]">
                                Delete this address?
                              </p>

                              <p className="mt-1 text-xs leading-5 text-[#878787]">
                                Past orders keep their own delivery details.
                                {address.is_default &&
                                  " Another saved address will become your default."}
                              </p>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  disabled={isDeleting}
                                  className={`cursor-pointer rounded-md border border-[#D0D0D0] bg-white px-4 py-2 text-sm font-semibold text-[#555] hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                                >
                                  Keep
                                </button>

                                <button
                                  type="button"
                                  onClick={() => removeAddress(address)}
                                  disabled={isDeleting}
                                  className={`cursor-pointer rounded-md bg-[#D32F2F] px-4 py-2 text-sm font-bold text-white hover:bg-[#B71C1C] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                                >
                                  {isDeleting ? "Deleting..." : "Yes, delete"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                              <button
                                type="button"
                                onClick={() => openForm(address)}
                                className={`inline-flex cursor-pointer items-center gap-2 rounded-md text-sm font-bold text-[#2874F0] hover:text-[#1f65d6] ${FOCUS_RING}`}
                              >
                                <Edit3 size={15} aria-hidden="true" />
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setPageError("");
                                  setConfirmDeleteId(address.id);
                                }}
                                className={`inline-flex cursor-pointer items-center gap-2 rounded-md text-sm font-bold text-[#D32F2F] hover:text-[#B71C1C] ${FOCUS_RING}`}
                              >
                                <Trash2 size={15} aria-hidden="true" />
                                Delete
                              </button>

                              {!address.is_default && (
                                <button
                                  type="button"
                                  onClick={() => makeDefault(address)}
                                  disabled={Boolean(defaultingId)}
                                  className={`inline-flex cursor-pointer items-center gap-2 rounded-md text-sm font-bold text-[#388E3C] hover:text-[#2E7D32] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
                                >
                                  <Check size={15} aria-hidden="true" />
                                  {isDefaulting ? "Updating..." : "Set as default"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              {/* CONTINUE CHECKOUT */}
              <section className="mt-5 border border-[#E0E0E0] bg-white">
                <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F5E9] text-[#388E3C]">
                      <Check size={19} aria-hidden="true" />
                    </div>

                    <div>
                      <h2 className="text-sm font-bold text-[#212121]">
                        Ready to checkout?
                      </h2>

                      <p className="mt-1 text-xs leading-5 text-[#878787]">
                        Choose your delivery address during checkout and review
                        your order before placing it.
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/checkout"
                    className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6] sm:w-auto ${FOCUS_RING}`}
                  >
                    Continue to Checkout
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </div>
              </section>
            </>
          )}

        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {formOpen && (
        <Modal
          labelledBy="address-dialog-title"
          dismissible={!busy}
          onRequestClose={requestClose}
        >
          <div className="flex items-center justify-between border-b border-[#E0E0E0] px-5 py-4">
            <div>
              <h2
                id="address-dialog-title"
                className="text-lg font-bold text-[#212121]"
              >
                {editing ? "Edit Address" : "Add New Address"}
              </h2>

              <p className="mt-1 text-xs text-[#878787]">
                Enter your delivery details.
              </p>
            </div>

            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              aria-label="Close"
              className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#555] transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            >
              <X size={19} aria-hidden="true" />
            </button>
          </div>

          <form onSubmit={submit} noValidate className="p-5">
            {formError && (
              <div
                role="alert"
                className="mb-5 border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3 text-sm text-[#D32F2F]"
              >
                {formError}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              {FIELDS.map((field, index) => {
                const {
                  name,
                  label,
                  optional,
                  autoComplete,
                  maxLength,
                  placeholder,
                  inputMode,
                  readOnly,
                  wide,
                } = field;

                const inputId = `address-${name}`;
                const errorId = `${inputId}-error`;
                const hasError = Boolean(fieldErrors[name]);

                return (
                  <div key={name} className={wide ? "sm:col-span-2" : ""}>
                    <label
                      htmlFor={inputId}
                      className="text-sm font-semibold text-[#212121]"
                    >
                      {label}
                      {optional && (
                        <span className="ml-1 font-normal text-[#878787]">
                          (optional)
                        </span>
                      )}
                    </label>

                    <input
                      id={inputId}
                      name={name}
                      value={form[name]}
                      onChange={change}
                      autoComplete={autoComplete}
                      inputMode={inputMode}
                      maxLength={maxLength}
                      placeholder={placeholder}
                      readOnly={readOnly}
                      disabled={busy}
                      data-autofocus={index === 0 ? "" : undefined}
                      aria-invalid={hasError}
                      aria-describedby={hasError ? errorId : undefined}
                      className={`mt-2 h-11 w-full rounded-md border px-3 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0] disabled:cursor-not-allowed disabled:bg-[#F5F5F5] ${
                        readOnly ? "cursor-not-allowed bg-[#F5F5F5] text-[#555]" : ""
                      } ${
                        hasError
                          ? "border-[#D32F2F] focus:border-[#D32F2F] focus:ring-[#D32F2F]"
                          : "border-[#D0D0D0]"
                      }`}
                    />

                    {hasError && (
                      <p
                        id={errorId}
                        className="mt-1.5 text-xs font-normal text-[#D32F2F]"
                      >
                        {fieldErrors[name]}
                      </p>
                    )}
                  </div>
                );
              })}

              <div className="sm:col-span-2">
                <label
                  htmlFor="address-is_default"
                  className={`flex items-center gap-3 ${
                    lockDefault || busy ? "cursor-not-allowed" : "cursor-pointer"
                  }`}
                >
                  <input
                    id="address-is_default"
                    type="checkbox"
                    name="is_default"
                    checked={lockDefault ? true : form.is_default}
                    onChange={change}
                    disabled={lockDefault || busy}
                    className="h-4 w-4 cursor-pointer accent-[#2874F0] disabled:cursor-not-allowed"
                  />

                  <span>
                    <span className="block text-sm font-semibold text-[#212121]">
                      Set as default address
                    </span>

                    <span className="mt-0.5 block text-xs text-[#878787]">
                      {isFirstAddress
                        ? "Your first address is saved as your default."
                        : editing?.is_default
                          ? "This is your default address. Set another address as default to change it."
                          : "Use this address automatically during checkout."}
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {confirmDiscard && (
              <div
                role="alertdialog"
                aria-labelledby="discard-title"
                className="mt-7 border border-[#F2D49A] bg-[#FFF9EC] p-4"
              >
                <p
                  id="discard-title"
                  className="text-sm font-semibold text-[#212121]"
                >
                  Discard your changes?
                </p>

                <p className="mt-1 text-xs leading-5 text-[#878787]">
                  What you’ve entered hasn’t been saved.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    ref={keepEditingRef}
                    type="button"
                    onClick={() => setConfirmDiscard(false)}
                    className={`cursor-pointer rounded-md bg-[#2874F0] px-4 py-2 text-sm font-bold text-white hover:bg-[#1f65d6] ${FOCUS_RING}`}
                  >
                    Keep editing
                  </button>

                  <button
                    type="button"
                    onClick={closeForm}
                    className={`cursor-pointer rounded-md border border-[#D0D0D0] bg-white px-4 py-2 text-sm font-semibold text-[#D32F2F] hover:bg-[#FFF1F1] ${FOCUS_RING}`}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#E0E0E0] pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={requestClose}
                disabled={busy}
                className={`cursor-pointer rounded-md border border-[#D0D0D0] px-6 py-3 text-sm font-bold text-[#212121] transition hover:bg-[#F1F3F6] disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={busy}
                className={`cursor-pointer rounded-md bg-[#2874F0] px-7 py-3 text-sm font-bold !text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
              >
                {busy
                  ? "Saving..."
                  : editing
                    ? "Save Changes"
                    : "Save Address"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export default Addresses;