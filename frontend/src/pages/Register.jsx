import { useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, UserPlus, ShieldCheck } from "lucide-react";

import api from "../services/api";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";
import useAuth from "../context/useAuth";

const NETWORK_ERROR = "Network problem. Check your connection and try again.";
const GENERIC_ERROR =
  "We couldn’t create your account. Please check your details and try again.";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELDS = [
  {
    name: "first_name",
    label: "First name",
    type: "text",
    autoComplete: "given-name",
    maxLength: 100,
    placeholder: "Enter your first name",
  },
  {
    name: "last_name",
    label: "Last name (optional)",
    type: "text",
    autoComplete: "family-name",
    maxLength: 100,
    placeholder: "Enter your last name",
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    autoComplete: "email",
    maxLength: 254,
    placeholder: "you@example.com",
    inputMode: "email",
  },
  {
    name: "phone_number",
    label: "Phone number",
    type: "tel",
    autoComplete: "tel",
    maxLength: 20,
    placeholder: "Enter phone number",
    inputMode: "tel",
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    autoComplete: "new-password",
    maxLength: MAX_PASSWORD_LENGTH,
    placeholder: "Minimum 8 characters",
    isPassword: true,
  },
  {
    name: "confirm",
    label: "Confirm password",
    type: "password",
    autoComplete: "new-password",
    maxLength: MAX_PASSWORD_LENGTH,
    placeholder: "Re-enter your password",
    isPassword: true,
  },
];

const FIELD_ORDER = FIELDS.map((f) => f.name);
const BACKEND_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "phone_number",
  "password",
];

const getSafeFrom = (value) => {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
};

const getErrorMessage = (error, fallback) => {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;

  if (status === 429) {
    return "Too many registration attempts. Please wait a few minutes and try again.";
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.msg) return String(item.msg);
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

const isValidPhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) return /^[6-9]\d{9}$/.test(digits);
  if (digits.length === 11 && digits.startsWith("0"))
    return /^0[6-9]\d{9}$/.test(digits);
  if (digits.length === 12 && digits.startsWith("91"))
    return /^91[6-9]\d{9}$/.test(digits);

  return false;
};

const normalizePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);

  return digits;
};

const mapBackendFieldErrors = (detail) => {
  const mapped = {};

  if (!Array.isArray(detail)) return mapped;

  detail.forEach((item) => {
    const loc = Array.isArray(item?.loc) ? item.loc : [];
    const field = loc[loc.length - 1];

    if (!BACKEND_FIELDS.includes(field)) return;
    if (mapped[field]) return;

    const message = item?.msg
      ? String(item.msg).replace(/^Value error,\s*/i, "")
      : "";

    if (message) mapped[field] = message;
  });

  return mapped;
};

function Register() {
  const branding = useContext(SiteBrandingContext) || {};
  const { siteName = "TerraLens" } = branding;

  const { isAuthenticated } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  const from = getSafeFrom(location.state?.from);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    password: "",
    confirm: "",
  });

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loadingRef = useRef(false);
  const errorRef = useRef(null);
  const mountedRef = useRef(false);
  const focusTargetRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from || "/", { replace: true });
    }
  }, [isAuthenticated, from, navigate]);
  useEffect(() => {
    if (!error || !errorRef.current) return;

    errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    errorRef.current.focus?.({ preventScroll: true });
  }, [error]);
  useEffect(() => {
    if (loading || !focusTargetRef.current) return;

    const el = document.getElementById(`register-${focusTargetRef.current}`);
    focusTargetRef.current = null;

    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }, [loading, fieldErrors]);

  const change = (e) => {
    const { name, value } = e.target;

    setForm((current) => ({ ...current, [name]: value }));

    setFieldErrors((current) => {
      if (!current[name]) return current;

      const next = { ...current };
      delete next[name];
      return next;
    });

    if (error) setError("");
  };

  const validate = () => {
    const nextErrors = {};

    const firstName = form.first_name.trim();
    const lastName = form.last_name.trim();
    const email = form.email.trim();
    const phone = form.phone_number.trim();
    const { password, confirm } = form;

    if (!firstName) {
      nextErrors.first_name = "First name is required.";
    }

    if (lastName.length > 100) {
      nextErrors.last_name = "Last name is too long.";
    }

    if (!email) {
      nextErrors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!phone) {
      nextErrors.phone_number = "Phone number is required.";
    } else if (!isValidPhone(phone)) {
      nextErrors.phone_number = "Enter a valid 10-digit Indian mobile number.";
    }

    if (!password) {
      nextErrors.password = "Password is required.";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      nextErrors.password = `Password must contain at least ${MIN_PASSWORD_LENGTH} characters.`;
    } else if (password.length > MAX_PASSWORD_LENGTH) {
      nextErrors.password = `Password must not exceed ${MAX_PASSWORD_LENGTH} characters.`;
    }

    if (!confirm) {
      nextErrors.confirm = "Please confirm your password.";
    } else if (password !== confirm) {
      nextErrors.confirm = "Passwords do not match.";
    }

    return nextErrors;
  };

  const firstInvalidField = (errors) =>
    FIELD_ORDER.find((name) => errors[name]) || null;

  const submit = async (e) => {
    e.preventDefault();
    if (loadingRef.current) return;

    setError("");
    setFieldErrors({});

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      focusTargetRef.current = firstInvalidField(validationErrors);
      setFieldErrors(validationErrors);
      return;
    }

    loadingRef.current = true;
    setLoading(true);

    try {
      await api.post("/auth/register", {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        email: form.email.trim().toLowerCase(),
        phone_number: normalizePhone(form.phone_number),
        password: form.password,
      });

      if (!mountedRef.current) return;

      navigate("/login", {
        replace: true,
        state: {
          message: "Your account is ready. Sign in to continue.",
          from,
        },
      });
    } catch (err) {
      if (!mountedRef.current) return;

      const mapped = mapBackendFieldErrors(err?.response?.data?.detail);

      if (Object.keys(mapped).length > 0) {
        // Field-level errors only: no duplicate banner.
        focusTargetRef.current = firstInvalidField(mapped);
        setFieldErrors(mapped);
        setError("");
      } else {
        setError(getErrorMessage(err, GENERIC_ERROR));
      }
    } finally {
      loadingRef.current = false;

      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F3F6] px-4 py-8 sm:px-6 sm:py-12">
      <SEO
        title="Create Account"
        description={`Create your ${siteName} account to manage orders, wishlist, and addresses.`}
        noIndex
      />

      <div className="mx-auto max-w-5xl">
        {/* HEADER */}
        <div className="mb-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2874F0]">
            Join {siteName}
          </p>

          <h1 className="mt-2 text-2xl font-bold text-[#212121] sm:text-3xl">
            Create your account
          </h1>

          <p className="mt-2 text-sm text-[#878787]">
            Manage your orders, wishlist and addresses in one place.
          </p>
        </div>

        {/* REGISTER CARD */}
        <div className="overflow-hidden rounded-md border border-[#E0E0E0] bg-white">
          <div className="grid lg:grid-cols-[0.85fr_1.5fr]">
            {/* LEFT PANEL */}
            <div className="hidden bg-[#172337] p-8 text-white lg:block">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#2874F0]">
                    <UserPlus size={24} />
                  </div>

                  <h2 className="mt-6 text-2xl font-bold">
                    Welcome to {siteName}
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#D8DEE8]">
                    Create your {siteName} account and keep your shopping
                    experience organised in one place.
                  </p>
                </div>

                <div className="mt-10 space-y-4">
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <ShieldCheck size={16} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">Secure account</p>
                      <p className="mt-1 text-xs text-[#B8C1CF]">
                        Your account information stays protected.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <UserPlus size={16} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">One account</p>
                      <p className="mt-1 text-xs text-[#B8C1CF]">
                        Manage orders, wishlist and addresses from one place.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* FORM */}
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-[#212121]">
                  Account details
                </h2>

                <p className="mt-1 text-sm text-[#878787]">
                  Enter your details to get started.
                </p>
              </div>

              {error && (
                <div
                  ref={errorRef}
                  role="alert"
                  tabIndex={-1}
                  className="mb-6 rounded-md border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3 text-sm text-[#D32F2F] outline-none"
                >
                  {error}
                </div>
              )}

              <form
                onSubmit={submit}
                noValidate
                className="grid gap-5 sm:grid-cols-2"
              >
                {FIELDS.map((field) => {
                  const {
                    name,
                    label,
                    type,
                    autoComplete,
                    maxLength,
                    placeholder,
                    inputMode,
                    isPassword,
                  } = field;

                  const isMainPassword = name === "password";
                  const visible = isMainPassword
                    ? showPassword
                    : showConfirmPassword;

                  const hasError = Boolean(fieldErrors[name]);
                  const inputId = `register-${name}`;
                  const errorId = `${inputId}-error`;
                  const noteId = "register-password-note";

                  const describedBy =
                    [
                      hasError ? errorId : null,
                      isMainPassword ? noteId : null,
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined;

                  return (
                    <div
                      key={name}
                      className="text-sm font-semibold text-[#212121]"
                    >
                      <label htmlFor={inputId}>{label}</label>

                      <div className="relative mt-2">
                        <input
                          id={inputId}
                          name={name}
                          type={isPassword && visible ? "text" : type}
                          autoComplete={autoComplete}
                          inputMode={inputMode}
                          autoCapitalize={
                            name === "email" || isPassword ? "none" : undefined
                          }
                          spellCheck={
                            name === "email" || isPassword ? false : undefined
                          }
                          disabled={loading}
                          maxLength={maxLength}
                          aria-invalid={hasError}
                          aria-describedby={describedBy}
                          value={form[name]}
                          onChange={change}
                          placeholder={placeholder}
                          className={`block h-11 w-full rounded-md border bg-white px-3 ${
                            isPassword ? "pr-11" : ""
                          } text-sm font-normal text-[#212121] outline-none transition placeholder:text-[#999] focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0] disabled:cursor-not-allowed disabled:bg-[#F5F5F5] ${
                            hasError
                              ? "border-[#D32F2F] focus:border-[#D32F2F] focus:ring-[#D32F2F]"
                              : "border-[#D0D0D0]"
                          }`}
                        />

                        {isPassword && (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() =>
                              isMainPassword
                                ? setShowPassword((current) => !current)
                                : setShowConfirmPassword((current) => !current)
                            }
                            aria-label={
                              isMainPassword
                                ? visible
                                  ? "Hide password"
                                  : "Show password"
                                : visible
                                  ? "Hide confirm password"
                                  : "Show confirm password"
                            }
                            aria-pressed={visible}
                            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#878787] transition hover:text-[#2874F0] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        )}
                      </div>

                      {hasError && (
                        <p
                          id={errorId}
                          className="mt-1.5 text-xs font-normal text-[#D32F2F]"
                        >
                          {fieldErrors[name]}
                        </p>
                      )}

                      {isMainPassword && (
                        <p
                          id={noteId}
                          className="mt-1.5 text-xs font-normal text-[#878787]"
                        >
                          Use {MIN_PASSWORD_LENGTH} to {MAX_PASSWORD_LENGTH}{" "}
                          characters.
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* CONSENT */}
                <div className="sm:col-span-2">
                  <p className="text-xs leading-5 text-[#878787]">
                    By creating an account, you agree to our{" "}
                    <Link
                      to="/terms"
                      state={{ from }}
                      className="font-semibold text-[#2874F0] hover:text-[#1f65d6]"
                    >
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link
                      to="/privacy"
                      state={{ from }}
                      className="font-semibold text-[#2874F0] hover:text-[#1f65d6]"
                    >
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </div>

                {/* SUBMIT */}
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-6 text-sm font-bold !text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    <UserPlus size={17} />
                    {loading ? "Creating account..." : "Create account"}
                  </button>

                  <div className="mt-6 border-t border-[#E0E0E0] pt-5">
                    <p className="text-sm text-[#878787]">
                      Already have an account?{" "}
                      <Link
                        className="cursor-pointer font-bold text-[#2874F0] hover:text-[#1f65d6]"
                        to="/login"
                        state={{ from }}
                      >
                        Sign in
                      </Link>
                    </p>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;