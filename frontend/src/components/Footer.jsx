import { Link } from "react-router-dom";
import { ArrowUp, ArrowUpRight, Mail } from "lucide-react";
import BrandMark from "./BrandMark";

const linkGroups = [
  {
    title: "Shop",
    links: [
      { label: "All products", to: "/shop" },
      { label: "Categories", to: "/categories" },
      { label: "Deals", to: "/deals" },
      { label: "Wishlist", to: "/wishlist" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "My account", to: "/account" },
      { label: "Orders", to: "/orders" },
      { label: "Cart", to: "/cart" },
      { label: "Addresses", to: "/addresses" },
    ],
  },
];

const linkClass =
  "group flex items-center gap-1.5 text-sm text-[#59645c] transition-all duration-200 hover:translate-x-1 hover:text-[#486B57] focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4";

function Footer() {
  const scrollToTop = () => {
    const top = document.getElementById("page-top");

    if (top) {
      top.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <footer className="mt-20 border-t border-[#E3E5DF] bg-white">
      <div className="mx-auto max-w-7xl px-6 py-14 sm:py-16">
        {/* Main footer */}
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <BrandMark
              logoType="footer"
              imageClassName="h-10 max-w-44 object-contain"
            />

            <p className="mt-4 max-w-sm text-sm leading-7 text-[#737A74]">
              Thoughtfully selected products for everyday living. Simple,
              useful and made to fit beautifully into your everyday spaces.
            </p>

            {/* Email */}
            <a
              href="mailto:hello@terralens.com"
              className="group mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#486B57] transition-colors hover:text-[#385744]"
            >
              <Mail size={16} />
              <span>hello@terralens.com</span>

              <ArrowUpRight
                size={14}
                className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </a>
          </div>

          {/* Navigation */}
          {linkGroups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1F2521]">
                {group.title}
              </h3>

              <ul className="mt-5 space-y-3.5">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className={linkClass}>
                      <span>{link.label}</span>

                      <ArrowUpRight
                        size={13}
                        className="opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Trust strip */}
        <div className="mt-14 grid gap-4 border-y border-[#E3E5DF] py-7 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DCE7DE] text-sm font-semibold text-[#385744]">
              ✓
            </span>

            <div>
              <p className="text-sm font-semibold text-[#1F2521]">
                Thoughtfully selected
              </p>
              <p className="mt-0.5 text-xs text-[#737A74]">
                Products worth bringing home
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DCE7DE] text-sm font-semibold text-[#385744]">
              ✓
            </span>

            <div>
              <p className="text-sm font-semibold text-[#1F2521]">
                Secure checkout
              </p>
              <p className="mt-0.5 text-xs text-[#737A74]">
                Safe and simple shopping
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DCE7DE] text-sm font-semibold text-[#385744]">
              ✓
            </span>

            <div>
              <p className="text-sm font-semibold text-[#1F2521]">
                Made for everyday
              </p>
              <p className="mt-0.5 text-xs text-[#737A74]">
                Useful products, considered well
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-7 flex flex-col gap-4 text-xs text-[#737A74] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TerraLens. All rights reserved.</p>

          <div className="flex items-center gap-5">
            <Link
              to="/privacy"
              className="transition-colors hover:text-[#486B57]"
            >
              Privacy
            </Link>

            <Link
              to="/terms"
              className="transition-colors hover:text-[#486B57]"
            >
              Terms
            </Link>

            <span className="text-[#B0B5B0]">Made with care.</span>
          </div>

          {/* Back to top */}
          <button
            type="button"
            onClick={scrollToTop}
            className="group inline-flex items-center gap-2 self-start rounded-full border border-[#E3E5DF] px-4 py-2.5 text-xs font-medium text-[#59645c] transition-all duration-200 hover:-translate-y-1 hover:border-[#486B57] hover:bg-[#DCE7DE] hover:text-[#385744] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#486B57]/30 sm:self-auto cursor-pointer"
          >
            <span>Back to top</span>

            <ArrowUp
              size={14}
              className="transition-transform duration-200 group-hover:-translate-y-0.5"
            />
          </button>
        </div>
      </div>
    </footer>
  );
}

export default Footer;