import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Send } from "lucide-react";

import api from "../services/api";
import SEO from "../components/SEO";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    try {
      setLoading(true);

      const response = await api.post(
        "/auth/forgot-password",
        {
          email: email.trim(),
        },
      );

      setMessage(
        response.data?.message ||
          "If an account with that email exists, a password reset link has been sent.",
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Unable to process your request. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Forgot Password"
        description="Request a password reset link for your TerraLens account."
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

            <div className="mt-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
                <Mail size={22} />
              </div>

              <h1 className="mt-5 text-2xl font-bold text-[#212121]">
                Forgot your password?
              </h1>

              <p className="mt-2 text-sm leading-6 text-[#737A74]">
                Enter the email address associated with your
                account and we'll send you a password reset link.
              </p>
            </div>

            <form
              onSubmit={submit}
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
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="Enter your email"
                autoComplete="email"
                required
                disabled={loading}
                className="mt-2 block h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm text-[#212121] outline-none transition placeholder:text-[#999] focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0] disabled:bg-[#F5F5F5]"
              />

              {error && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              {message && (
                <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm leading-5 text-green-700">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-6 text-sm font-bold text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={17} />

                {loading
                  ? "Sending..."
                  : "Send reset link"}
              </button>
            </form>

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