import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Heart,
  MapPin,
  Package,
  LogOut,
  UserRound,
  ShieldCheck,
} from "lucide-react";

import useAuth from "../context/useAuth";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { siteName = "TerraLens" } = useContext(
    SiteBrandingContext,
  );
  const [busy, setBusy] = useState(false);

  const signOut = () => {
    setBusy(true);
    logout();
    navigate("/", { replace: true });
  };

  const links = [
    {
      Icon: Package,
      title: "Your Orders",
      desc: "Track, manage and review your purchases.",
      to: "/orders",
    },
    {
      Icon: Heart,
      title: "Wishlist",
      desc: "View the products you have saved.",
      to: "/wishlist",
    },
    {
      Icon: MapPin,
      title: "Addresses",
      desc: "Manage your delivery and saved addresses.",
      to: "/addresses",
    },
  ];

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim();

  return (
  <>
    <SEO
      title="Account"
      description={`Manage your ${siteName} profile, orders, wishlist, and addresses.`}
      noIndex
    />

    <div className="min-h-screen bg-[#F1F3F6] pb-16">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* HEADER */}
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#2874F0]">
            My account
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#212121]">
            Account
          </h1>

          <p className="mt-1 text-sm text-[#878787]">
            Manage your profile, orders, wishlist and addresses.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">

          {/* LEFT */}
          <div className="space-y-5">

            {/* PROFILE */}
            <section className="overflow-hidden rounded-md border border-[#E0E0E0] bg-white">
              <div className="border-b border-[#E0E0E0] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
                    <UserRound size={19} />
                  </div>

                  <div>
                    <h2 className="font-bold text-[#212121]">
                      Personal Information
                    </h2>

                    <p className="text-xs text-[#878787]">
                      Your account details
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="grid gap-5 sm:grid-cols-2">

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                      Full Name
                    </p>

                    <p className="mt-2 text-sm font-semibold text-[#212121]">
                      {fullName || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                      Email
                    </p>

                    <p className="mt-2 break-all text-sm font-semibold text-[#212121]">
                      {user?.email || "Not provided"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#878787]">
                      Phone
                    </p>

                    <p className="mt-2 text-sm font-semibold text-[#212121]">
                      {user?.phone_number || "Not provided"}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* ACCOUNT LINKS */}
            <section className="rounded-md border border-[#E0E0E0] bg-white">
              <div className="border-b border-[#E0E0E0] px-5 py-4">
                <h2 className="font-bold text-[#212121]">
                  Account Settings
                </h2>

                <p className="mt-1 text-xs text-[#878787]">
                  Quickly access your shopping activity.
                </p>
              </div>

              <div className="divide-y divide-[#F0F0F0]">
                {links.map(
                  ({ Icon, title, desc, to }) => (
                    <Link
                      key={to}
                      to={to}
                      className="group flex cursor-pointer items-center gap-4 px-5 py-5 transition hover:bg-[#FAFAFA]"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F5F7FA] text-[#2874F0] transition group-hover:bg-[#E8F0FE]">
                        <Icon size={20} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-[#212121]">
                          {title}
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-[#878787]">
                          {desc}
                        </p>
                      </div>

                      <ArrowRight
                        size={18}
                        className="shrink-0 text-[#878787] transition group-hover:translate-x-1 group-hover:text-[#2874F0]"
                      />
                    </Link>
                  ),
                )}
              </div>
            </section>
          </div>

          {/* RIGHT */}
          <aside className="space-y-5">

            {/* ACCOUNT CARD */}
            <section className="rounded-md border border-[#E0E0E0] bg-white p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2874F0] text-xl font-bold text-white">
                  {(
                    user?.first_name?.[0] ||
                    user?.email?.[0] ||
                    "U"
                  ).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-[#878787]">
                    Welcome
                  </p>

                  <h2 className="truncate text-lg font-bold text-[#212121]">
                    {user?.first_name || "Customer"}
                  </h2>
                </div>
              </div>

              <div className="mt-5 rounded-md bg-[#F5F9FF] p-3">
                <div className="flex gap-3">
                  <ShieldCheck
                    size={18}
                    className="mt-0.5 shrink-0 text-[#2874F0]"
                  />

                  <p className="text-xs leading-5 text-[#555]">
                    Your account helps keep your orders, addresses
                    and wishlist organized in one place.
                  </p>
                </div>
              </div>
            </section>

            {/* SIGN OUT */}
            <section className="rounded-md border border-[#E0E0E0] bg-white p-5">
              <h3 className="font-bold text-[#212121]">
                Account Actions
              </h3>

              <p className="mt-1 text-xs leading-5 text-[#878787]">
                Sign out from this TerraLens account on this device.
              </p>

              <button
                type="button"
                disabled={busy}
                onClick={signOut}
                className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#D0D0D0] bg-white px-5 py-3 text-sm font-bold text-[#212121] transition hover:border-[#2874F0] hover:bg-[#F5F9FF] hover:text-[#2874F0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut size={16} />

                {busy ? "Signing out..." : "Sign out"}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
    </>
  );
}

export default Account;