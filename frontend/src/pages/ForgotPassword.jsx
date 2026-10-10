import {
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  ArrowLeft,
  Check,
  Mail,
  Send,
} from "lucide-react";

import api from "../services/api";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

const NETWORK_ERROR =
  "Network problem. Check your connection and try again.";

const GENERIC_ERROR =
  "Unable to process your request. Please try again.";

const RATE_LIMIT_ERROR =
  "Too many attempts. Please wait a few minutes and try again.";

const RESEND_COOLDOWN_SECONDS = 60;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const getRequestError = (error) => {
  const status = error?.response?.status;

  if (status === 429) {
    return RATE_LIMIT_ERROR;
  }

  if (status === 422) {
    const detail = error.response?.data?.detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail) && detail[0]?.msg) {
      return String(detail[0].msg).replace(
        /^Value error,\s*/i,
        "",
      );
    }

    return "Enter a valid email address.";
  }

  if (!error?.response && error?.request) {
    return NETWORK_ERROR;
  }

  return GENERIC_ERROR;
};

function ForgotPassword() {
  const { siteName = "TerraLens" } =
    useContext(SiteBrandingContext) || {};

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const loadingRef = useRef(false);
  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setCooldown((seconds) => seconds - 1);
    }, 1000);

    return () => {
      clearTimeout(timer);
    };
  }, [cooldown]);

  const sendLink = async (address) => {
    if (loadingRef.current) {
      return;
    }

    const value = address.trim();

    if (!value) {
      setError("Please enter your email address.");
      return;
    }

    if (!EMAIL_PATTERN.test(value)) {
      setError("Enter a valid email address.");
      return;
    }

    loadingRef.current = true;
    setLoading(true);
    setError("");

    try {
      await api.post("/auth/forgot-password", {
        email: value,
      });

      setSentTo(value);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (requestError) {
      setError(getRequestError(requestError));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendLink(email);
  };

  const handleResend = () => {
    if (cooldown > 0) {
      return;
    }

    sendLink(sentTo || email);
  };

  const useDifferentEmail = () => {
    setSentTo(null);
    setError("");
    setCooldown(0);
  };

  return (
    <>
      <SEO
        title="Forgot Password"
        description={`Request a password reset link for your ${siteName} account.`}
        noIndex
      />

      <div className="min-h-screen bg-[#F1F3F6] px-4 py-12 sm:px-6">
        <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
          <div className="w-full rounded-2xl border border-[#E3E5DF] bg-white p-6 shadow-sm sm:p-8">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#2874F0] hover:text-[#1f65d6]"
            >
              <ArrowLeft size={16} />
              Back to login
            </Link>

            {sentTo ? (
              /* ------------------------------ Sent ------------------------------ */
              <div className="mt-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F5E9] text-[#388E3C]">
                  <Check size={24} />
                </div>

                <h1 className="mt-5 text-2xl font-bold text-[#212121]">
                  Check your email
                </h1>

                <p
                  role="status"
                  className="mt-2 text-sm leading-6 text-[#737A74]"
                >
                  If an account exists for{" "}
                  <strong className="break-all text-[#212121]">
                    {sentTo}
                  </strong>
                  , we've sent a link to reset your password.
                </p>

                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-5 text-[#737A74]">
                  <li>It can take a few minutes to arrive.</li>
                  <li>Check your spam or junk folder.</li>
                  <li>The link expires after a short time.</li>
                </ul>

                {error && (
                  <div
                    role="alert"
                    className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || cooldown > 0}
                  className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-6 text-sm font-bold text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={17} />

                  {loading
                    ? "Sending..."
                    : cooldown > 0
                      ? `Resend in ${cooldown}s`
                      : "Resend link"}
                </button>

                <button
                  type="button"
                  onClick={useDifferentEmail}
                  disabled={loading}
                  className="mt-3 block w-full cursor-pointer text-center text-sm font-semibold text-[#2874F0] hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <div className="mt-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
                    <Mail size={22} />
                  </div>

                  <h1 className="mt-5 text-2xl font-bold text-[#212121]">
                    Forgot your password?
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-[#737A74]">
                    Enter the email address associated with your
                    account and we'll send you a password reset
                    link.
                  </p>
                </div>

                <form
                  onSubmit={handleSubmit}
                  noValidate
                  className="mt-7"
                >
                  <label
                    htmlFor="forgot-password-email"
                    className="block text-sm font-semibold text-[#212121]"
                  >
                    Email address
                  </label>

                  <input
                    id="forgot-password-email"
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                    }}
                    placeholder="Enter your email"
                    autoComplete="email"
                    autoFocus
                    maxLength={254}
                    required
                    disabled={loading}
                    aria-invalid={Boolean(error)}
                    aria-describedby={
                      error ? "forgot-password-error" : undefined
                    }
                    className="mt-2 block h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-[#212121] outline-none transition placeholder:text-[#999] focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0] disabled:bg-[#F5F5F5]"
                  />

                  {error && (
                    <div
                      id="forgot-password-error"
                      role="alert"
                      className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-6 text-sm font-bold text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send size={17} />

                    {loading ? "Sending..." : "Send reset link"}
                  </button>
                </form>
              </>
            )}

            <div className="mt-6 border-t border-[#E0E0E0] pt-5 text-center">
              <p className="text-sm text-[#878787]">
                Remember your password?{" "}
                <Link
                  to="/login"
                  className="font-bold text-[#2874F0] hover:text-[#1f65d6]"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ForgotPassword;