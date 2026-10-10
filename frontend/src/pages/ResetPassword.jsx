import {
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
} from "lucide-react";

import api from "../services/api";
import BrandMark from "../components/BrandMark";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

const NETWORK_ERROR =
  "Network problem. Check your connection and try again.";

const RATE_LIMIT_ERROR =
  "Too many attempts. Please wait a few minutes and try again.";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const VALIDATE_TOKEN_REJECTED = [400, 401, 403, 404, 410, 422];
const SUBMIT_TOKEN_REJECTED = [401, 403, 404, 410];

const getErrorMessage = (error, fallback) => {
  const status = error?.response?.status;

  if (status === 429) {
    return RATE_LIMIT_ERROR;
  }

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

const readResetToken = (hash, searchParams) => {
  const fromHash = new URLSearchParams(
    String(hash || "").replace(/^#/, ""),
  ).get("token");

  return fromHash || searchParams.get("token") || "";
};

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#F1F3F6] px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandMark
            alwaysShowName
            fallbackLogo
            className="gap-2"
            imageClassName="h-9 w-9 shrink-0 object-contain"
            nameClassName="text-xl font-semibold tracking-tight text-[#344d3e]"
          />
        </div>

        {children}
      </div>
    </div>
  );
}

const TONES = {
  neutral: "bg-[#EEF1EE] text-[#6B706C]",
  danger: "bg-[#FFF1F0] text-[#C62828]",
  success: "bg-[#E8F5E9] text-[#388E3C]",
};

function MessageCard({ tone = "neutral", icon, title, text, children }) {
  return (
    <div className="rounded-2xl border border-[#E3E5DF] bg-white p-8 text-center shadow-sm">
      <div
        className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full ${TONES[tone]}`}
      >
        {icon}
      </div>

      <h1 className="text-2xl font-bold text-[#202521]">{title}</h1>

      <p
        role={tone === "danger" ? "alert" : "status"}
        className="mt-3 text-sm leading-6 text-[#6B706C]"
      >
        {text}
      </p>

      {children}
    </div>
  );
}

const primaryButton =
  "mt-6 block w-full cursor-pointer rounded-lg bg-[#2874F0] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-60";

const secondaryLink =
  "mt-4 block text-sm font-semibold text-[#2874F0] hover:underline";

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  toggleLabel,
  placeholder,
  disabled,
  autoFocus,
  invalid,
  describedBy,
  children,
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-semibold text-[#202521]"
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="new-password"
          autoFocus={autoFocus}
          maxLength={MAX_PASSWORD_LENGTH}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="w-full rounded-lg border border-[#D6D9D5] px-4 py-3 pr-12 text-sm outline-none transition focus:border-[#2874F0] focus:ring-2 focus:ring-[#2874F0]/10 disabled:bg-[#F5F5F5]"
        />

        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={toggleLabel}
          aria-pressed={show}
          className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#777D78] hover:text-[#202521] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {children}
    </div>
  );
}

function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const { siteName = "TerraLens" } =
    useContext(SiteBrandingContext) || {};

  const [token, setToken] = useState(() =>
    readResetToken(location.hash, searchParams),
  );

  const [status, setStatus] = useState(token ? "checking" : "missing");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submittingRef = useRef(false);

  useEffect(() => {
    if (location.search || location.hash) {
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    const meta = document.createElement("meta");

    meta.name = "referrer";
    meta.content = "no-referrer";

    document.head.appendChild(meta);

    return () => {
      meta.remove();
    };
  }, []);


  useEffect(() => {
    if (status !== "checking") {
      return undefined;
    }

    let cancelled = false;

    api
      .post("/auth/validate-reset-token", { token })
      .then(() => {
        if (!cancelled) {
          setStatus("valid");
        }
      })
      .catch((requestError) => {
        if (cancelled) {
          return;
        }

        setStatus(
          VALIDATE_TOKEN_REJECTED.includes(
            requestError.response?.status,
          )
            ? "invalid"
            : "error",
        );

        if (requestError.response?.status === 429) {
          setError(RATE_LIMIT_ERROR);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, token]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    if (!token) {
      setStatus("missing");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      );
      return;
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      setError(
        `Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`,
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError("");

    try {
      await api.post("/auth/reset-password", {
        token,
        new_password: password,
      });

      setPassword("");
      setConfirmPassword("");
      setToken("");
      setSuccess(true);
    } catch (requestError) {
      if (
        SUBMIT_TOKEN_REJECTED.includes(requestError.response?.status)
      ) {
        setPassword("");
        setConfirmPassword("");
        setStatus("invalid");
      } else {
        setError(
          getErrorMessage(
            requestError,
            "Unable to reset your password. Please try again.",
          ),
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const retryCheck = () => {
    setError("");
    setStatus("checking");
  };


  const seo = (
    <SEO
      title="Reset Password"
      description={`Choose a new password for your ${siteName} account.`}
      noIndex
    />
  );

  if (success) {
    return (
      <>
        {seo}

        <Shell>
          <MessageCard
            tone="success"
            icon={<CheckCircle2 size={28} />}
            title="Password reset successful"
            text="Your password has been updated. You can now sign in with your new password."
          >
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className={primaryButton}
            >
              Back to sign in
            </button>
          </MessageCard>
        </Shell>
      </>
    );
  }

  if (status === "checking") {
    return (
      <>
        {seo}

        <Shell>
          <MessageCard
            icon={<LockKeyhole size={26} />}
            title="Checking reset link"
            text="Please wait while we verify your password reset link."
          />
        </Shell>
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        {seo}

        <Shell>
          <MessageCard
            tone="danger"
            icon={<LockKeyhole size={26} />}
            title="Couldn't check your link"
            text={
              error ||
              "We couldn't verify your reset link. Check your connection and try again."
            }
          >
            <button
              type="button"
              onClick={retryCheck}
              className={primaryButton}
            >
              Try again
            </button>

            <Link to="/login" className={secondaryLink}>
              Back to sign in
            </Link>
          </MessageCard>
        </Shell>
      </>
    );
  }

  if (status === "missing" || status === "invalid") {
    return (
      <>
        {seo}

        <Shell>
          <MessageCard
            tone="danger"
            icon={<LockKeyhole size={26} />}
            title={
              status === "missing"
                ? "Reset link incomplete"
                : "Reset link expired"
            }
            text={
              status === "missing"
                ? "This link is missing its reset code. Open the link from your email again, or request a new one."
                : "This password reset link is invalid, has expired, or has already been used. Please request a new one."
            }
          >
            <Link to="/forgot-password" className={primaryButton}>
              Request a new reset link
            </Link>

            <Link to="/login" className={secondaryLink}>
              Back to sign in
            </Link>
          </MessageCard>
        </Shell>
      </>
    );
  }

  const mismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <>
      {seo}

      <Shell>
        <div className="rounded-2xl border border-[#E3E5DF] bg-white p-8 shadow-sm">
          <div className="mb-6">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[#2874F0] text-white">
              <LockKeyhole size={24} />
            </div>

            <h1 className="text-2xl font-bold text-[#202521]">
              Reset your password
            </h1>

            <p className="mt-2 text-sm text-[#6B706C]">
              Enter a new password for your {siteName} account.
            </p>
          </div>

          {error && (
            <div
              id="reset-error"
              role="alert"
              className="mb-5 rounded-lg border border-[#F2C8C5] bg-[#FFF1F0] px-4 py-3 text-sm font-medium text-[#C62828]"
            >
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            noValidate
            className="space-y-5"
          >
            <PasswordField
              id="new-password"
              label="New password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              show={showPassword}
              onToggle={() => setShowPassword((current) => !current)}
              toggleLabel={
                showPassword ? "Hide new password" : "Show new password"
              }
              placeholder="Enter your new password"
              disabled={submitting}
              autoFocus
              invalid={Boolean(error)}
              describedBy={error ? "reset-error" : "password-hint"}
            >
              <p
                id="password-hint"
                className="mt-2 text-xs text-[#777D78]"
              >
                Use at least {MIN_PASSWORD_LENGTH} characters.
              </p>
            </PasswordField>

            <PasswordField
              id="confirm-password"
              label="Confirm password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setError("");
              }}
              show={showConfirmPassword}
              onToggle={() =>
                setShowConfirmPassword((current) => !current)
              }
              toggleLabel={
                showConfirmPassword
                  ? "Hide password confirmation"
                  : "Show password confirmation"
              }
              placeholder="Confirm your new password"
              disabled={submitting}
              invalid={mismatch}
              describedBy={mismatch ? "confirm-hint" : undefined}
            >
              {mismatch && (
                <p
                  id="confirm-hint"
                  className="mt-2 text-xs text-[#C62828]"
                >
                  Passwords do not match.
                </p>
              )}
            </PasswordField>

            <button
              type="submit"
              disabled={submitting}
              className="w-full cursor-pointer rounded-lg bg-[#2874F0] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Resetting password..." : "Reset password"}
            </button>
          </form>

          <div className="mt-6 border-t border-[#E8EAE6] pt-5 text-center">
            <Link
              to="/login"
              className="text-sm font-semibold text-[#2874F0] hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </Shell>
    </>
  );
}

export default ResetPassword;