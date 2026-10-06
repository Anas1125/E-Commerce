import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Heart,
  Menu,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";

import useAuth from "../context/useAuth";
import BrandMark from "./BrandMark";

function Navbar() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const {
    isAuthenticated,
    user,
    cartCount,
    wishlistCount,
    refreshCounts,
  } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts, location.pathname]);

  const links = [
    ["Home", "/"],
    ["Shop", "/shop"],
    ["Categories", "/categories"],
    ["Deals", "/deals"],
  ];

  const accountPath = isAuthenticated
    ? "/account"
    : "/login";

  const submitSearch = (event) => {
    event.preventDefault();

    const query = search.trim();

    if (!query) {
      navigate("/shop");
      setSearchOpen(false);
      setOpen(false);
      return;
    }

    navigate(
      `/shop?search=${encodeURIComponent(query)}`,
    );

    setSearchOpen(false);
    setOpen(false);
  };

  const handleSearchClick = () => {
    setSearchOpen((current) => !current);
    setOpen(false);
  };

  const icons = (
    <>
      {/* SEARCH */}
      <button
        type="button"
        aria-label={
          searchOpen
            ? "Close search"
            : "Search"
        }
        onClick={handleSearchClick}
        className="icon-link cursor-pointer"
      >
        {searchOpen ? (
          <X size={19} />
        ) : (
          <Search size={19} />
        )}
      </button>

      {/* WISHLIST */}
      <Link
        to="/wishlist"
        aria-label="Wishlist"
        onClick={() => setOpen(false)}
        className="icon-link relative"
      >
        <Heart size={19} />

        {wishlistCount > 0 && (
          <span className="count-badge">
            {wishlistCount}
          </span>
        )}
      </Link>

      {/* CART */}
      <Link
        to="/cart"
        aria-label="Cart"
        onClick={() => setOpen(false)}
        className="icon-link relative"
      >
        <ShoppingBag size={19} />

        {cartCount > 0 && (
          <span className="count-badge">
            {cartCount}
          </span>
        )}
      </Link>

      {/* ACCOUNT */}
      <Link
        to={accountPath}
        aria-label={
          isAuthenticated
            ? `Account for ${
                user?.first_name || "user"
              }`
            : "Sign in"
        }
        onClick={() => setOpen(false)}
        className="icon-link"
      >
        <User size={19} />
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-[#E3E5DF] bg-[#F5F5F1]/95 backdrop-blur">
      <nav className="relative mx-auto flex h-[68px] max-w-7xl items-center justify-between px-6">

        {/* LOGO */}
        <BrandMark
          alwaysShowName
          fallbackLogo
          className="gap-2"
          imageClassName="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
          nameClassName="text-base font-semibold tracking-tight text-[#344d3e] sm:text-lg"
        />

        {/* DESKTOP NAVIGATION */}
        <div className="hidden items-center gap-8 md:flex">
          {links.map(([name, to]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `text-sm transition hover:text-[#486B57] ${
                  isActive
                    ? "font-semibold text-[#486B57]"
                    : "text-[#4f5851]"
                }`
              }
            >
              {name}
            </NavLink>
          ))}
        </div>

        {/* DESKTOP ICONS */}
        <div className="hidden items-center gap-4 md:flex">
          {icons}
        </div>

        {/* MOBILE HEADER ACTIONS */}
        <div className="flex items-center gap-2 md:hidden">

          {/* MOBILE SEARCH */}
          <button
            type="button"
            aria-label={
              searchOpen
                ? "Close search"
                : "Search"
            }
            onClick={handleSearchClick}
            className="cursor-pointer rounded-full p-2 text-[#39453d] transition hover:bg-[#DCE7DE]"
          >
            {searchOpen ? (
              <X size={21} />
            ) : (
              <Search size={21} />
            )}
          </button>

          {/* MOBILE MENU */}
          <button
            type="button"
            className="cursor-pointer rounded-full p-2 text-[#39453d] transition hover:bg-[#DCE7DE]"
            aria-label={
              open
                ? "Close menu"
                : "Open menu"
            }
            onClick={() => {
              setOpen((current) => !current);
              setSearchOpen(false);
            }}
          >
            {open ? (
              <X size={21} />
            ) : (
              <Menu size={21} />
            )}
          </button>
        </div>

        {/* DESKTOP SEARCH */}
        {searchOpen && (
          <form
            onSubmit={submitSearch}
            className="absolute right-6 top-[76px] hidden w-[420px] rounded-xl border border-[#E3E5DF] bg-white p-3 shadow-lg md:block"
          >
            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#878787]"
              />

              <input
                autoFocus
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search products, brands and more"
                autoComplete="off"
                className="h-11 w-full rounded-lg border border-[#D8DDD8] bg-white pl-10 pr-10 text-sm text-[#212121] outline-none transition focus:border-[#486B57] focus:ring-1 focus:ring-[#486B57]/20"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#878787] hover:bg-[#F1F3F6] hover:text-[#212121]"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <p className="px-1 pt-2 text-[11px] text-[#878787]">
              Search products, brands and categories
            </p>
          </form>
        )}
      </nav>

      {/* MOBILE SEARCH BAR */}
      {searchOpen && (
        <form
          onSubmit={submitSearch}
          className="border-t border-[#E3E5DF] bg-[#F5F5F1] px-4 py-3 md:hidden"
        >
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#878787]"
            />

            <input
              autoFocus
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search products, brands and more"
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-[#D8DDD8] bg-white pl-9 pr-10 text-sm text-[#212121] outline-none focus:border-[#486B57]"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#878787] hover:bg-[#F1F3F6]"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </form>
      )}

      {/* MOBILE MENU */}
      {open && (
        <div className="border-t border-[#E3E5DF] bg-[#F5F5F1] px-6 py-4 md:hidden">

          {/* MOBILE LINKS */}
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

          {/* MOBILE ICONS */}
          <div className="flex gap-5 border-t border-[#E3E5DF] pt-4">
            <Link
              to="/wishlist"
              aria-label="Wishlist"
              onClick={() => setOpen(false)}
              className="icon-link relative"
            >
              <Heart size={19} />

              {wishlistCount > 0 && (
                <span className="count-badge">
                  {wishlistCount}
                </span>
              )}
            </Link>

            <Link
              to="/cart"
              aria-label="Cart"
              onClick={() => setOpen(false)}
              className="icon-link relative"
            >
              <ShoppingBag size={19} />

              {cartCount > 0 && (
                <span className="count-badge">
                  {cartCount}
                </span>
              )}
            </Link>

            <Link
              to={accountPath}
              aria-label={
                isAuthenticated
                  ? `Account for ${
                      user?.first_name || "user"
                    }`
                  : "Sign in"
              }
              onClick={() => setOpen(false)}
              className="icon-link"
            >
              <User size={19} />
            </Link>
          </div>
        </div>
      )}

      <style>{`
        .icon-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #39453d;
          transition: color 0.15s;
        }

        .icon-link:hover {
          color: #486B57;
        }

        .count-badge {
          position: absolute;
          right: -9px;
          top: -8px;
          min-width: 16px;
          border-radius: 999px;
          background: #486B57;
          padding: 1px 4px;
          text-align: center;
          font-size: 9px;
          color: #fff;
        }
      `}</style>
    </header>
  );
}

export default Navbar;