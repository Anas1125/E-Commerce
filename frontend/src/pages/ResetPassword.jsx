import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, CheckCircle2 } from "lucide-react";

import api from "../services/api";

function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");

    if (!token) {
      setError("This password reset link is invalid.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);

      await api.post("/auth/reset-password", {
        token,
        new_password: password,
      });

      setSuccess(true);
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Unable to reset your password. Please request a new reset link.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[calc(100vh-80px)] bg-[#F4F6F4] px-4 py-12">
        <div className="mx-auto flex max-w-md justify-center">
          <div className="w-full rounded-2xl border border-[#E3E5DF] bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#DCE7DE] text-[#486B57]">
              <CheckCircle2 size={28} />
            </div>

            <h1 className="text-2xl font-bold text-[#202521]">
              Password reset successful
            </h1>

            <p className="mt-3 text-sm leading-6 text-[#6B706C]">
              Your password has been updated successfully.
              You can now sign in with your new password.
            </p>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="mt-6 w-full cursor-pointer rounded-lg bg-[#2878E8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1F68D0]"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F4F6F4] px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-[#E3E5DF] bg-white p-8 shadow-sm">
          <div className="mb-6">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-[#2878E8] text-white">
              <LockKeyhole size={24} />
            </div>

            <h1 className="text-2xl font-bold text-[#202521]">
              Reset your password
            </h1>

            <p className="mt-2 text-sm text-[#6B706C]">
              Enter a new password for your TerraLens account.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-lg border border-[#F2C8C5] bg-[#FFF1F0] px-4 py-3 text-sm font-medium text-[#C62828]">
              {error}
            </div>
          )}

          {!token ? (
            <div>
              <p className="text-sm text-[#6B706C]">
                This password reset link is missing or invalid.
              </p>

              <Link
                to="/forgot-password"
                className="mt-5 block text-center text-sm font-semibold text-[#2878E8] hover:underline"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-2 block text-sm font-semibold text-[#202521]"
                >
                  New password
                </label>

                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your new password"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-[#D6D9D5] px-4 py-3 pr-12 text-sm outline-none transition focus:border-[#2878E8] focus:ring-2 focus:ring-[#2878E8]/10"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#777D78] hover:text-[#202521]"
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>

                <p className="mt-2 text-xs text-[#777D78]">
                  Use at least 8 characters.
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="mb-2 block text-sm font-semibold text-[#202521]"
                >
                  Confirm password
                </label>

                <div className="relative">
                  <input
                    id="confirm-password"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Confirm your new password"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-[#D6D9D5] px-4 py-3 pr-12 text-sm outline-none transition focus:border-[#2878E8] focus:ring-2 focus:ring-[#2878E8]/10"
                    required
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(
                        (current) => !current,
                      )
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-[#777D78] hover:text-[#202521]"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full cursor-pointer rounded-lg bg-[#2878E8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1F68D0] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting
                  ? "Resetting password..."
                  : "Reset password"}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-[#E8EAE6] pt-5 text-center">
            <Link
              to="/login"
              className="text-sm font-semibold text-[#486B57] hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;