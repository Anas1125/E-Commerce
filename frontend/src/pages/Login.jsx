import { useState } from "react";
import { Eye, EyeOff, Leaf } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import useAuth from "../context/useAuth";
function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });
      const me = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      login(data.access_token, me.data);
      navigate(location.state?.from?.pathname || "/", { replace: true });
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
    <div className="mx-auto grid min-h-[680px] max-w-6xl items-stretch gap-7 px-6 py-10 lg:grid-cols-2">
      <section className="relative hidden overflow-hidden rounded-3xl bg-[#dce7de] p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_15%,white_0,transparent_45%),linear-gradient(150deg,#e5ebe3,#cad8cb)]" />
        <div className="relative flex items-center gap-2 font-semibold text-[#486B57]">
          <Leaf size={20} />
          TerraLens
        </div>
        <div className="relative max-w-md pb-8">
          <p className="eyebrow">A considered collection</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Make room for things you’ll love living with.
          </h1>
          <p className="mt-5 text-sm leading-6 text-[#59645c]">
            Sign in to see your orders, save favourites, and pick up where you
            left off.
          </p>
        </div>
        <span className="relative text-xs text-[#68766c]">
          Thoughtfully selected for everyday living.
        </span>
      </section>
      <section className="flex items-center justify-center rounded-3xl border border-[#E3E5DF] bg-white px-6 py-10 sm:px-12">
        <form onSubmit={submit} className="w-full max-w-md">
          <p className="eyebrow">Welcome back</p>
          <h2 className="mt-2 text-3xl font-semibold">Sign in</h2>
          <p className="mt-3 text-sm text-[#737A74]">
            Enter your account details to continue.
          </p>
          {location.state?.message && (
            <p
              role="status"
              className="mt-5 rounded-xl bg-[#e9eee8] px-4 py-3 text-sm text-[#486B57]"
            >
              {location.state.message}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-[#f8e8e3] px-4 py-3 text-sm text-[#8b4033]"
            >
              {error}
            </p>
          )}
          <label className="mt-6 block text-sm font-medium">
            Email
            <input
              type="email"
              autoComplete="email"
              required
              className="field mt-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="mt-4 block text-sm font-medium">
            Password
            <span className="relative mt-2 block">
              <input
                type={visible ? "text" : "password"}
                autoComplete="current-password"
                required
                className="field pr-12"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={visible ? "Hide password" : "Show password"}
                onClick={() => setVisible(!visible)}
                className="absolute right-3 top-3 text-[#737A74]"
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <div className="mt-3 text-right">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-[#486B57]"
            >
              Forgot password?
            </Link>
          </div>
          <button disabled={loading} className="button-primary mt-6 w-full">
            {loading ? "Signing in…" : "Sign In"}
          </button>
          <p className="mt-6 text-center text-sm text-[#737A74]">
            New to TerraLens?{" "}
            <Link className="font-semibold text-[#486B57]" to="/register">
              Create account
            </Link>
          </p>
        </form>
      </section>
    </div>
  );
}
export default Login;
