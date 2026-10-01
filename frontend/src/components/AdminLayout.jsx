import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Percent,
  Shapes,
  Users,
  Warehouse,
  X,
  RotateCcw,
  Settings,
} from "lucide-react";
import useAuth from "../context/useAuth";
import BrandMark from "./BrandMark";
const nav = [
  [LayoutDashboard, "Overview", "/admin"],
  [Boxes, "Products", "/admin/products"],
  [Shapes, "Categories", "/admin/categories"],
  [ClipboardList, "Orders", "/admin/orders"],
  [Users, "Customers", "/admin/customers"],
  [Warehouse, "Inventory", "/admin/inventory"],
  [Percent, "Discounts", "/admin/discounts"],
  [RotateCcw, "Refunds", "/admin/refunds"],
  [Settings, "Site Settings", "/admin/settings"],
];
function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const signOut = () => {
    logout();
    navigate("/admin/login", { replace: true });
  };
  return (
    <div className="min-h-screen bg-[#F5F5F1] lg:grid lg:grid-cols-[250px_1fr]">
      <aside
        className={`${open ? "fixed inset-y-0 left-0 z-[70] block w-[280px]" : "hidden"} border-r border-[#E3E5DF] bg-white p-5 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-auto`}
      >
        <div className="flex items-center justify-between">
          <BrandMark />
          <button
            aria-label="Close admin menu"
            className="rounded p-2 lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        <p className="eyebrow mt-10">Store management</p>
        <nav className="mt-4 space-y-1">
          {nav.map(([Icon, label, to]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive ? "bg-[#DCE7DE] font-semibold text-[#385744]" : "text-[#5c655e] hover:bg-[#F5F5F1]"}`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 border-t border-[#E3E5DF] pt-4 lg:relative lg:bottom-auto lg:left-auto lg:right-auto lg:mt-10">
          <p className="text-sm font-medium">
            {user?.first_name} {user?.last_name || ""}
          </p>
          <p className="mt-1 truncate text-xs text-[#737A74]">{user?.email}</p>
          <button
            onClick={signOut}
            className="mt-3 text-sm font-medium text-[#486B57]"
          >
            Sign out
          </button>
        </div>
      </aside>
      {open && (
        <button
          aria-label="Close menu overlay"
          className="fixed inset-0 z-[65] bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-[68px] items-center justify-between border-b border-[#E3E5DF] bg-[#F5F5F1]/95 px-5 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              aria-label="Open admin menu"
              className="rounded-lg p-2 hover:bg-[#DCE7DE] lg:hidden"
            >
              <Menu size={19} />
            </button>
            <span className="hidden text-xs uppercase tracking-[.16em] text-[#737A74] sm:block">
              TerraLens Admin
            </span>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[#486B57]">
            <Activity size={15} />
            Store operations
          </span>
        </header>
        <main className="mx-auto max-w-[1500px] p-5 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
export default AdminLayout;
