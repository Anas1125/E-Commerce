import { useState } from "react";
import { Eye, EyeOff, Leaf } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import useAuth from "../context/useAuth";
import BrandMark from "../components/BrandMark";

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data } = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });
      const me = await api.get("/auth/me", {
        headers: { Authorization: `${data.token_type} ${data.access_token}` },
      });

      if (me.data.role !== "admin") {
        setError("This account does not have administrator access.");
        return;
      }

      login(data.access_token, me.data, "admin");
      navigate(location.state?.from?.pathname || "/admin", { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[650px] max-w-5xl items-center gap-8 px-6 py-12 md:grid-cols-2">
      <section className="rounded-3xl bg-[#DCE7DE] p-9 sm:p-12">
        <BrandMark />
        <p className="eyebrow mt-16">TerraLens operations</p>
        <h1 className="mt-3 text-3xl font-semibold">
          A considered way to manage your store.
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#657067]">
          Sign in with an administrator account to manage products, orders,
          inventory, and customer service.
        </p>
        <Leaf size={26} className="mt-12 text-[#486B57]" />
      </section>

      <form
        onSubmit={submit}
        className="rounded-3xl border border-[#E3E5DF] bg-white p-7 sm:p-10"
      >
        <p className="eyebrow">Administrator sign in</p>
        <h2 className="mt-2 text-2xl font-semibold">Welcome back</h2>
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-xl bg-[#f8e8e3] p-3 text-sm text-[#8b4033]"
          >
            {error}
          </p>
        )}
        <label className="mt-6 block text-sm font-medium">
          Email
          <input
            type="email"
            required
            autoComplete="username"
            className="field mt-2"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Password
          <span className="relative mt-2 block">
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              className="field pr-12"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-3 text-[#737A74] hover:text-[#486B57] cursor-pointer"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        <button disabled={loading} className="button-primary mt-6 w-full cursor-pointer">
          {loading ? "Signing in…" : "Sign in to admin"}
        </button>
      </form>
    </div>
  );
}

export default AdminLogin;
