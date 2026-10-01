import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import useAuth from "../context/useAuth";
import BrandMark from "./BrandMark";

function Navbar() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, user, cartCount, wishlistCount, refreshCounts } =
    useAuth();
  const location = useLocation();

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts, location.pathname]);

  const links = [
    ["Home", "/"],
    ["Shop", "/shop"],
    ["Categories", "/categories"],
    ["Deals", "/deals"],
  ];
  const accountPath = isAuthenticated ? "/account" : "/login";
  const icons = (
    <>
      <Link to="/search" aria-label="Search" className="icon-link">
        <Search size={19} />
      </Link>
      <Link to="/wishlist" aria-label="Wishlist" className="icon-link relative">
        <Heart size={19} />
        {wishlistCount > 0 && (
          <span className="count-badge">{wishlistCount}</span>
        )}
      </Link>
      <Link to="/cart" aria-label="Cart" className="icon-link relative">
        <ShoppingBag size={19} />
        {cartCount > 0 && <span className="count-badge">{cartCount}</span>}
      </Link>
      <Link
        to={accountPath}
        aria-label={
          isAuthenticated ? `Account for ${user?.first_name}` : "Sign in"
        }
        className="icon-link"
      >
        <User size={19} />
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-[#E3E5DF] bg-[#F5F5F1]/95 backdrop-blur">
      <nav className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-6">
        <BrandMark
          alwaysShowName
          fallbackLogo
          className="gap-2"
          imageClassName="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
          nameClassName="text-base font-semibold tracking-tight text-[#344d3e] sm:text-lg"
        />
        <div className="hidden items-center gap-8 md:flex">
          {links.map(([name, to]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `text-sm transition hover:text-[#486B57] ${isActive ? "font-semibold text-[#486B57]" : "text-[#4f5851]"}`
              }
            >
              {name}
            </NavLink>
          ))}
        </div>
        <div className="hidden items-center gap-4 md:flex">{icons}</div>
        <button
          className="rounded-full p-2 hover:bg-[#DCE7DE] md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </nav>
      {open && (
        <div className="border-t border-[#E3E5DF] bg-[#F5F5F1] px-6 py-4 md:hidden">
          <div className="flex flex-col">
            {links.map(([name, to]) => (
              <Link
                key={to}
                onClick={() => setOpen(false)}
                className="py-3 text-sm"
                to={to}
              >
                {name}
              </Link>
            ))}
          </div>
          <div className="flex gap-5 border-t border-[#E3E5DF] pt-4">
            {icons}
          </div>
        </div>
      )}
      <style>{`.icon-link{display:inline-flex;align-items:center;justify-content:center;color:#39453d;transition:color .15s}.icon-link:hover{color:#486B57}.count-badge{position:absolute;right:-9px;top:-8px;min-width:16px;border-radius:999px;background:#486B57;padding:1px 4px;text-align:center;font-size:9px;color:#fff}`}</style>
    </header>
  );
}

export default Navbar;
