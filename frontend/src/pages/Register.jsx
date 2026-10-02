import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, ShieldCheck } from "lucide-react";
import api from "../services/api";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

function Register() {
  const { siteName = "TerraLens" } = useContext(
    SiteBrandingContext,
  );

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    password: "",
    confirm: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const change = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (form.password.length < 8) {
      setError(
        "Use a password with at least 8 characters.",
      );
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/register", {
        first_name: form.first_name.trim(),
        last_name:
          form.last_name.trim() || null,
        email: form.email.trim(),
        phone_number:
          form.phone_number.trim(),
        password: form.password,
      });

      navigate("/login", {
        replace: true,
        state: {
          message:
            "Your account is ready. Sign in to continue.",
        },
      });
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "We couldn’t create your account. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    ["first_name", "First name", "text"],
    ["last_name", "Last name (optional)", "text"],
    ["email", "Email", "email"],
    ["phone_number", "Phone number", "tel"],
    ["password", "Password", "password"],
    ["confirm", "Confirm password", "password"],
  ];

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
            Create an account to manage your orders,
            wishlist and addresses.
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
                    Create your {siteName} account and keep
                    your shopping experience organised in
                    one place.
                  </p>
                </div>

                <div className="mt-10 space-y-4">

                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <ShieldCheck size={16} />
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        Secure account
                      </p>

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
                      <p className="text-sm font-semibold">
                        One account
                      </p>

                      <p className="mt-1 text-xs text-[#B8C1CF]">
                        Manage orders, wishlist and addresses
                        from one place.
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
                  role="alert"
                  className="mb-6 rounded-md border border-[#FFCDD2] bg-[#FFEBEE] px-4 py-3 text-sm text-[#D32F2F]"
                >
                  {error}
                </div>
              )}

              <form
                onSubmit={submit}
                className="grid gap-5 sm:grid-cols-2"
              >
                {fields.map(
                  ([name, label, type]) => (
                    <label
                      key={name}
                      className="block text-sm font-semibold text-[#212121]"
                    >
                      {label}

                      <input
                        required={
                          !name.includes(
                            "last_name",
                          )
                        }
                        minLength={
                          name === "password"
                            ? 8
                            : undefined
                        }
                        type={type}
                        name={name}
                        autoComplete={
                          name === "confirm"
                            ? "new-password"
                            : name
                        }
                        className="mt-2 block h-11 w-full rounded-md border border-[#D0D0D0] bg-white px-3 text-sm font-normal text-[#212121] outline-none transition placeholder:text-[#999] focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]"
                        value={form[name]}
                        onChange={change}
                        placeholder={
                          name === "first_name"
                            ? "Enter your first name"
                            : name ===
                                "last_name"
                              ? "Enter your last name"
                              : name === "email"
                                ? "you@example.com"
                                : name ===
                                    "phone_number"
                                  ? "Enter phone number"
                                  : name ===
                                      "password"
                                    ? "Minimum 8 characters"
                                    : "Re-enter your password"
                        }
                      />
                    </label>
                  ),
                )}

                {/* PASSWORD NOTE */}
                <div className="sm:col-span-2">
                  <p className="text-xs text-[#878787]">
                    Password must contain at least 8
                    characters.
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

                    {loading
                      ? "Creating account..."
                      : "Create account"}
                  </button>

                  <div className="mt-6 border-t border-[#E0E0E0] pt-5">
                    <p className="text-sm text-[#878787]">
                      Already have an account?{" "}
                      <Link
                        className="cursor-pointer font-bold text-[#2874F0] hover:text-[#1f65d6]"
                        to="/login"
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

        {/* BOTTOM INFO */}
        <p className="mt-5 text-center text-xs text-[#878787]">
          By creating an account, you can manage your
          {siteName} shopping activity in one place.
        </p>

      </div>
    </div>
  );
}

export default Register;