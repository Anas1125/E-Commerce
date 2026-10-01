import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Heart, MapPin, Package, LogOut } from "lucide-react";
import useAuth from "../context/useAuth";
function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const signOut = () => {
    setBusy(true);
    logout();
    navigate("/", { replace: true });
  };
  const links = [
    [Package, "Your orders", "Track and review your purchases", "/orders"],
    [Heart, "Wishlist", "Return to the pieces you saved", "/wishlist"],
    [MapPin, "Addresses", "Manage your delivery details", "/addresses"],
  ];
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <p className="eyebrow">Your TerraLens</p>
      <h1 className="mt-2 text-3xl font-semibold">Account</h1>
      <section className="mt-8 rounded-2xl border border-[#E3E5DF] bg-white p-6 sm:p-8">
        <p className="text-sm text-[#737A74]">Profile</p>
        <h2 className="mt-2 text-xl font-semibold">
          {user?.first_name} {user?.last_name || ""}
        </h2>
        <p className="mt-1 text-sm text-[#737A74]">{user?.email}</p>
        <p className="mt-1 text-sm text-[#737A74]">{user?.phone_number}</p>
      </section>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {links.map(([Icon, title, desc, to]) => (
          <Link
            key={to}
            to={to}
            className="rounded-2xl border border-[#E3E5DF] bg-white p-6 transition hover:border-[#b8c7ba]"
          >
            <Icon className="text-[#486B57]" size={21} />
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#737A74]">{desc}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#486B57]">
              Manage
              <ArrowRight size={15} />
            </span>
          </Link>
        ))}
      </div>
      <button
        className="button-secondary mt-7 inline-flex gap-2"
        disabled={busy}
        onClick={signOut}
      >
        <LogOut size={16} />
        Sign out
      </button>
    </div>
  );
}
export default Account;
