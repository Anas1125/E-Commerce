import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";

import useAuth from "../context/useAuth";
import BrandMark from "./BrandMark";

const links = [
  { name: "Home", to: "/" },
  { name: "Shop", to: "/shop" },
  { name: "Categories", to: "/categories" },
  { name: "Deals", to: "/deals" },
];

const iconClass =
  "relative inline-flex cursor-pointer items-center justify-center rounded-full p-2 text-[#39453D] transition-colors hover:bg-[#DCE7DE] hover:text-[#486B57] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]/30";

const desktopLinkClass = ({ isActive }) =>
  `text-sm transition hover:text-[#486B57] ${
    isActive ? "font-semibold text-[#486B57]" : "text-[#4F5851]"
  }`;

const mobileLinkClass = ({ isActive }) =>
  `py-3 text-sm transition hover:text-[#486B57] ${
    isActive ? "font-semibold text-[#486B57]" : "text-[#4F5851]"
  }`;

const countLabel = (name, count) =>
  count > 0 ? `${name}, ${count} ${count === 1 ? "item" : "items"}` : name;

function CountBadge({ count }) {
  if (count <= 0) return null;

  return (
    <span
      aria-hidden="true"
      className="absolute -right-0.5 -top-0.5 min-w-[16px] rounded-full bg-[#486B57] px-1 py-px text-center text-[9px] leading-4 text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SearchForm({ value, onChange, onSubmit }) {
  return (
    <form
      id="site-search"
      role="search"
      onSubmit={onSubmit}
      className="border-t border-[#E3E5DF] bg-[#F5F5F1] px-4 py-3 md:absolute md:right-6 md:top-2 md:w-[420px] md:rounded-xl md:border md:bg-white md:p-3 md:shadow-lg"
    >
      <div className="relative">
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#878787]"
        />

        <input
          autoFocus
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label="Search products"
          placeholder="Search products, brands and more"
          autoComplete="off"
          className="h-11 w-full rounded-lg border border-[#D8DDD8] bg-white pl-10 pr-10 text-sm text-[#212121] outline-none transition focus:border-[#486B57] focus:ring-1 focus:ring-[#486B57]/20"
        />

        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#878787] hover:bg-[#F1F3F6] hover:text-[#212121]"
          >
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      <p className="hidden px-1 pt-2 text-[11px] text-[#878787] md:block">
        Search products, brands and categories
      </p>
    </form>
  );
}

function Navbar() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const headerRef = useRef(null);

  const { isAuthenticated, user, cartCount, wishlistCount, refreshCounts } =
    useAuth();

  const location = useLocation();
  const navigate = useNavigate();
  const [prevPathname, setPrevPathname] = useState(location.pathname);

  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    setOpen(false);
    setSearchOpen(false);
  }

  const accountPath = isAuthenticated ? "/account" : "/login";

  const closeAll = useCallback(() => {
    setOpen(false);
    setSearchOpen(false);
  }, []);

  // Refresh cart/wishlist counts on navigation
  useEffect(() => {
    refreshCounts();
  }, [refreshCounts, location.pathname]);

  // Close on Escape or when clicking outside the header
  useEffect(() => {
    if (!open && !searchOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") closeAll();
    };

    const onPointerDown = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        closeAll();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, searchOpen, closeAll]);

  const submitSearch = (event) => {
    event.preventDefault();

    const query = search.trim();

    navigate(
      query
        ? `/shop?search=${encodeURIComponent(query)}`
        : "/shop",
    );

    setSearch("");
    closeAll();
  };

  const toggleSearch = () => {
    setSearchOpen((current) => !current);
    setOpen(false);
  };

  const toggleMenu = () => {
    setOpen((current) => !current);
    setSearchOpen(false);
  };

  const searchButton = (
    <button
      type="button"
      aria-label={searchOpen ? "Close search" : "Search"}
      aria-expanded={searchOpen}
      aria-controls="site-search"
      onClick={toggleSearch}
      className={iconClass}
    >
      {searchOpen ? (
        <X size={20} aria-hidden="true" />
      ) : (
        <Search size={20} aria-hidden="true" />
      )}
    </button>
  );

  const wishlistLink = (
    <Link
      to="/wishlist"
      aria-label={countLabel("Wishlist", wishlistCount)}
      onClick={closeAll}
      className={iconClass}
    >
      <Heart size={20} aria-hidden="true" />
      <CountBadge count={wishlistCount} />
    </Link>
  );

  const cartLink = (
    <Link
      to="/cart"
      aria-label={countLabel("Cart", cartCount)}
      onClick={closeAll}
      className={iconClass}
    >
      <ShoppingBag size={20} aria-hidden="true" />
      <CountBadge count={cartCount} />
    </Link>
  );

  const accountLink = (
    <Link
      to={accountPath}
      aria-label={
        isAuthenticated ? `Account for ${user?.first_name || "user"}` : "Sign in"
      }
      onClick={closeAll}
      className={iconClass}
    >
      <User size={20} aria-hidden="true" />
    </Link>
  );

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b border-[#E3E5DF] bg-[#F5F5F1]/95 backdrop-blur"
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-6"
      >
        {/* Logo */}
        <BrandMark
          alwaysShowName
          fallbackLogo
          className="gap-2"
          imageClassName="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
          nameClassName="text-base font-semibold tracking-tight text-[#344D3E] sm:text-lg"
        />

        {/* Desktop links */}
        <div className="hidden items-center gap-8 md:flex">
          {links.map(({ name, to }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={desktopLinkClass}
            >
              {name}
            </NavLink>
          ))}
        </div>

        {/* Desktop icons */}
        <div className="hidden items-center gap-1 md:flex">
          {searchButton}
          {wishlistLink}
          {cartLink}
          {accountLink}
        </div>

        {/* Mobile header actions */}
        <div className="flex items-center gap-1 md:hidden">
          {searchButton}
          {cartLink}

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={toggleMenu}
            className={iconClass}
          >
            {open ? (
              <X size={21} aria-hidden="true" />
            ) : (
              <Menu size={21} aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      {/* Search: full-width bar on mobile, popover on desktop */}
      <div className="relative mx-auto max-w-7xl">
        {searchOpen && (
          <SearchForm
            value={search}
            onChange={setSearch}
            onSubmit={submitSearch}
          />
        )}
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          id="mobile-menu"
          className="border-t border-[#E3E5DF] bg-[#F5F5F1] px-6 py-4 md:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {links.map(({ name, to }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={closeAll}
                className={mobileLinkClass}
              >
                {name}
              </NavLink>
            ))}
          </nav>

          <div className="mt-2 flex gap-2 border-t border-[#E3E5DF] pt-4">
            {wishlistLink}
            {accountLink}
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar;