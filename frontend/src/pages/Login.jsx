import { useContext, useState } from "react";
import {
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
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

function Login() {
  const { siteName = "TerraLens" } = useContext(
    SiteBrandingContext,
  );

  const [email, setEmail] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [password, setPassword] =
    useState("");
  const [visible, setVisible] =
    useState(false);
  const [error, setError] =
    useState("");
  const [loading, setLoading] =
    useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError(
        "Enter your email and password.",
      );
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post(
        "/auth/login",
        {
          email: email.trim(),
          password,
        },
      );

      const me = await api.get(
        "/auth/me",
        {
          headers: {
            Authorization: `Bearer ${data.access_token}`,
          },
        },
      );

      login(
        data.access_token,
        me.data,
        "customer",
        rememberMe
      );

      navigate(
        location.state?.from
          ?.pathname || "/",
        {
          replace: true,
        },
      );
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "We couldn’t sign you in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F1F3F6] px-4 py-8 sm:px-6 sm:py-12">
      <SEO
        title="Sign In"
        description={`Sign in to your ${siteName} account to access your orders, wishlist, and account.`}
        noIndex
      />
      <div className="mx-auto max-w-5xl">

        {/* HEADER */}
        <div className="mb-5 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2874F0]">
            Welcome back
          </p>

          <h1 className="mt-2 text-2xl font-bold text-[#212121] sm:text-3xl">
            Sign in to {siteName}
          </h1>

          <p className="mt-2 text-sm text-[#878787]">
            Access your orders, wishlist and account.
          </p>
        </div>

        {/* LOGIN CARD */}
        <div className="overflow-hidden rounded-md border border-[#E0E0E0] bg-white">

          <div className="grid lg:grid-cols-[0.85fr_1.15fr]">

            {/* LEFT PANEL */}
            <div className="hidden bg-[#172337] p-8 text-white lg:block">

              <div className="flex h-full flex-col justify-between">

                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#2874F0]">
                    <LogIn size={24} />
                  </div>

                  <h2 className="mt-6 text-2xl font-bold">
                    Welcome back
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-[#D8DEE8]">
                    Sign in to continue shopping and
                    manage everything related to your
                    {siteName} account.
                  </p>
                </div>

                <div className="mt-10 space-y-4">

                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <ShieldCheck size={16} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        Secure sign in
                      </p>

                      <p className="mt-1 text-xs text-[#B8C1CF]">
                        Your account information is protected.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <LogIn size={16} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        Pick up where you left off
                      </p>

                      <p className="mt-1 text-xs text-[#B8C1CF]">
                        Access your orders, wishlist and saved
                        account information.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* FORM */}
            <div className="flex items-center px-6 py-8 sm:px-10 sm:py-10">

              <form
                onSubmit={submit}
                className="w-full"
              >

                <div className="mb-6">
                  <h2 className="text-lg font-bold text-[#212121]">
                    Account login
                  </h2>

                  <p className="mt-1 text-sm text-[#878787]">
                    Enter your registered email and password.
                  </p>
                </div>

                {/* SUCCESS MESSAGE */}
                {location.state?.message && (
                  <div
                    role="status"
                    className="mb-5 rounded-md border border-[#C8E6C9] bg-[#E8F5E9] px-4 py-3 text-sm text-[#388E3C]"
                  >
                    {location.state.message}
                  </div>
                )}

                {/* ERROR */}
                {error && (
                  <div
                    role="alert"
                    className="mb-5 rounded-md border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3 text-sm text-[#D32F2F]"
                  >
                    {error}
                  </div>
                )}

                {/* EMAIL */}
                <label className="block text-sm font-semibold text-[#212121]">
                  Email

                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) =>
                      setEmail(
                        e.target.value,
                      )
                    }
                    placeholder="you@example.com"
                    className="mt-2 block h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm font-normal text-[#212121] outline-none transition placeholder:text-[#999] focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                  />
                </label>

                {/* PASSWORD */}
                <label className="mt-5 block text-sm font-semibold text-[#212121]">
                  Password

                  <span className="relative mt-2 block">
                    <input
                      type={
                        visible
                          ? "text"
                          : "password"
                      }
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) =>
                        setPassword(
                          e.target.value,
                        )
                      }
                      placeholder="Enter your password"
                      className="block h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 pr-12 text-sm font-normal text-[#212121] outline-none transition placeholder:text-[#999] focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                    />

                    <button
                      type="button"
                      aria-label={
                        visible
                          ? "Hide password"
                          : "Show password"
                      }
                      onClick={() =>
                        setVisible(
                          !visible,
                        )
                      }
                      className="absolute right-0 top-0 flex h-11 w-11 cursor-pointer items-center justify-center text-[#878787] transition hover:text-[#2874F0]"
                    >
                      {visible ? (
                        <EyeOff
                          size={18}
                        />
                      ) : (
                        <Eye
                          size={18}
                        />
                      )}
                    </button>
                  </span>
                </label>

                {/* FORGOT PASSWORD */}
                <div className="mt-3 flex items-center justify-between gap-4">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#555]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(event) => setRememberMe(event.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded border-[#BDBDBD] text-[#2874F0] focus:ring-[#2874F0]"
                    />
                    <span>Remember me</span>
                  </label>

                  <Link
                    to="/forgot-password"
                    className="cursor-pointer text-sm font-bold text-[#2874F0] hover:text-[#1f65d6]"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* LOGIN */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-[#2874F0] px-6 text-sm font-bold !text-white transition hover:bg-[#1f65d6] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <LogIn size={17} />

                  {loading
                    ? "Signing in..."
                    : "Sign In"}
                </button>

                {/* REGISTER */}
                <div className="mt-6 border-t border-[#E0E0E0] pt-5 text-center">
                  <p className="text-sm text-[#878787]">
                    New to {siteName}?{" "}

                    <Link
                      className="cursor-pointer font-bold text-[#2874F0] hover:text-[#1f65d6]"
                      to="/register"
                    >
                      Create account
                    </Link>
                  </p>
                </div>

              </form>
            </div>
          </div>
        </div>

        {/* FOOTER NOTE */}
        <p className="mt-5 text-center text-xs text-[#878787]">
          Securely sign in to manage your {siteName}
          shopping account.
        </p>

      </div>
    </div>
  );
}

export default Login;