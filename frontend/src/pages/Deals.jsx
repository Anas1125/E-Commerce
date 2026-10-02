import {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowRight,
  Clock3,
  Search,
  Tag,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import api from "../services/api";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";
import {
  EmptyState,
  LoadingState,
  Price,
} from "../components/Storefront";

function Deals() {
  const { siteName = "TerraLens" } = useContext(
    SiteBrandingContext,
  );

  const [discounts, setDiscounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [images, setImages] = useState({});

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("discount");
  const [filter, setFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* =========================================================
     LOAD DEALS
  ========================================================= */

  useEffect(() => {
    let alive = true;

    const loadDeals = async () => {
      try {
        setLoading(true);
        setError("");

        const [discountResponse, productResponse] =
          await Promise.all([
            api.get("/discounts/"),
            api.get("/products/"),
          ]);

        const now = Date.now();

        const activeDiscounts =
          discountResponse.data.filter(
            (discount) =>
              discount.is_active &&
              new Date(discount.start_date).getTime() <= now &&
              new Date(discount.end_date).getTime() >= now,
          );

        const productData = productResponse.data;

        const imageResults = await Promise.all(
          productData.map(async (product) => {
            try {
              const response = await api.get(
                `/products/${product.id}/images`,
              );

              const image =
                response.data.find(
                  (item) => item.is_primary,
                ) || response.data[0];

              return [
                product.id,
                image?.image_url || null,
              ];
            } catch {
              return [product.id, null];
            }
          }),
        );

        if (!alive) return;

        setDiscounts(activeDiscounts);
        setProducts(productData);

        setImages(
          Object.fromEntries(
            imageResults.filter(([, url]) => url),
          ),
        );
      } catch (requestError) {
        if (!alive) return;

        setError(
          requestError.response?.data?.detail ||
            "Unable to load current offers.",
        );
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    loadDeals();

    return () => {
      alive = false;
    };
  }, []);

  /* =========================================================
     DISCOUNT HELPERS
  ========================================================= */

  const getDiscountAmount = (discount, product) => {
    if (!product) return 0;

    if (discount.discount_type === "percentage") {
      return (
        Number(product.price) *
        (Number(discount.value) / 100)
      );
    }

    return Math.min(
      Number(product.price),
      Number(discount.value),
    );
  };

  const getDiscountedPrice = (discount, product) => {
    if (!product) return 0;

    return Math.max(
      0,
      Number(product.price) -
        getDiscountAmount(discount, product),
    );
  };

  const getDiscountLabel = (discount) => {
    if (discount.discount_type === "percentage") {
      return `${Number(discount.value)}% OFF`;
    }

    return `₹${Number(
      discount.value,
    ).toLocaleString("en-IN")} OFF`;
  };

  const getDiscountPercentage = (discount, product) => {
    if (!product) return 0;

    if (discount.discount_type === "percentage") {
      return Number(discount.value);
    }

    if (!Number(product.price)) return 0;

    return (
      (Number(discount.value) /
        Number(product.price)) *
      100
    );
  };

  /* =========================================================
     BUILD DEAL PRODUCTS
  ========================================================= */

  const dealProducts = useMemo(() => {
    const result = [];

    products.forEach((product) => {
      const specificDeal = discounts.find(
        (discount) =>
          discount.product_id === product.id,
      );

      const storewideDeal = discounts.find(
        (discount) =>
          discount.product_id === null,
      );

      const deal =
        specificDeal || storewideDeal;

      if (!deal) return;

      result.push({
        product,
        discount: deal,
        discountedPrice: getDiscountedPrice(
          deal,
          product,
        ),
        discountPercentage:
          getDiscountPercentage(
            deal,
            product,
          ),
      });
    });

    return result;
  }, [products, discounts]);

  /* =========================================================
     FILTER + SORT
  ========================================================= */

  const filteredDeals = useMemo(() => {
    const query = search.trim().toLowerCase();

    let result = dealProducts.filter(
      ({ product, discount }) => {
        const matchesSearch =
          !query ||
          String(product.name || "")
            .toLowerCase()
            .includes(query) ||
          String(product.brand || "")
            .toLowerCase()
            .includes(query) ||
          String(discount.name || "")
            .toLowerCase()
            .includes(query);

        if (!matchesSearch) return false;

        if (filter === "20-plus") {
          return (
            getDiscountPercentage(
              discount,
              product,
            ) >= 20
          );
        }

        if (filter === "10-plus") {
          return (
            getDiscountPercentage(
              discount,
              product,
            ) >= 10
          );
        }

        return true;
      },
    );

    result = [...result];

    if (sort === "discount") {
      result.sort(
        (a, b) =>
          b.discountPercentage -
          a.discountPercentage,
      );
    }

    if (sort === "price-low") {
      result.sort(
        (a, b) =>
          a.discountedPrice -
          b.discountedPrice,
      );
    }

    if (sort === "price-high") {
      result.sort(
        (a, b) =>
          b.discountedPrice -
          a.discountedPrice,
      );
    }

    if (sort === "ending") {
      result.sort(
        (a, b) =>
          new Date(a.discount.end_date) -
          new Date(b.discount.end_date),
      );
    }

    return result;
  }, [
    dealProducts,
    search,
    sort,
    filter,
  ]);

  const clearFilters = () => {
    setSearch("");
    setSort("discount");
    setFilter("all");
  };

  const highestDiscount = useMemo(() => {
    return dealProducts.reduce(
      (highest, deal) =>
        Math.max(
          highest,
          deal.discountPercentage,
        ),
      0,
    );
  }, [dealProducts]);


  return (
    <main className="min-h-screen bg-[#F1F3F6]">
      <SEO
        title="Deals & Offers"
        description={`Discover current deals and special offers at ${siteName}. Save on products with limited-time discounts and special prices.`}
      />

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">


        <section className="mb-5 rounded-lg bg-white px-5 py-6 sm:px-7">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2874F0]">
                {siteName} offers
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#212121] sm:text-4xl">
                Deals & offers
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#878787]">
                Save more on products currently available
                at special prices.
              </p>
            </div>

            {!loading &&
              !error &&
              discounts.length > 0 && (
                <div className="flex gap-3">

                  <div className="rounded-md border border-[#E0E0E0] bg-[#FAFAFA] px-5 py-3">
                    <p className="text-xl font-bold text-[#212121]">
                      {dealProducts.length}
                    </p>

                    <p className="text-xs text-[#878787]">
                      deals available
                    </p>
                  </div>

                  <div className="rounded-md bg-[#EAF2FF] px-5 py-3">
                    <p className="text-xl font-bold text-[#2874F0]">
                      {Math.round(
                        highestDiscount,
                      )}
                      %
                    </p>

                    <p className="text-xs text-[#2874F0]">
                      maximum savings
                    </p>
                  </div>

                </div>
              )}

          </div>

        </section>


        {loading ? (
          <LoadingState label="Finding the latest offers..." />
        ) : error ? (
          <EmptyState
            title="Offers unavailable"
            text={error}
          />
        ) : discounts.length === 0 ? (
          <EmptyState
            title="No active offers right now"
            text="Our deals change from time to time. Check back soon or browse the full collection."
            action="Explore the shop"
            to="/shop"
          />
        ) : (
          <>

            {/* =================================================
                DEAL BANNER
            ================================================= */}

            <section className="relative mb-6 overflow-hidden rounded-lg bg-[#172337]">

              <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#2874F0]/20 blur-3xl" />

              <div className="absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-[#2874F0]/10 blur-3xl" />

              <div className="relative flex flex-col gap-6 px-6 py-7 sm:px-8 sm:py-8 lg:flex-row lg:items-center lg:justify-between">

                <div className="max-w-2xl">

                  <div className="flex items-center gap-2 text-[#FFE500]">
                    <Tag size={15} />

                    <span className="text-[11px] font-bold uppercase tracking-[0.18em]">
                      Limited-time deals
                    </span>
                  </div>

                  <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
                    Great products.
                    <br />
                    Better prices.
                  </h2>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
                    Explore current {siteName} discounts
                    before the offers end.
                  </p>

                </div>

                <Link
                  to="/shop"
                  className="inline-flex w-fit items-center gap-2 rounded-md bg-[#FFE500] px-5 py-3 text-sm font-bold !text-[#172337] transition hover:bg-[#F5D900]"
                >
                  Shop all products
                  <ArrowRight size={16} />
                </Link>

              </div>

            </section>


            {/* =================================================
                TOOLBAR
            ================================================= */}

            <section className="mb-5 rounded-lg bg-white p-4 sm:p-5">

              <div className="flex flex-col gap-3 lg:flex-row">

                {/* Search */}
                <div className="relative flex-1">

                  <Search
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#878787]"
                  />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder="Search deals, products or brands..."
                    className="h-11 w-full rounded-md border border-[#E0E0E0] bg-white pl-10 pr-10 text-sm outline-none transition focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]/20"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() =>
                        setSearch("")
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#878787] hover:text-[#212121]"
                    >
                      <X size={15} />
                    </button>
                  )}

                </div>


                {/* Controls */}
                <div className="flex flex-wrap gap-2">

                  <select
                    value={filter}
                    onChange={(event) =>
                      setFilter(
                        event.target.value,
                      )
                    }
                    className="h-11 rounded-md border border-[#E0E0E0] bg-white px-3 text-sm outline-none focus:border-[#2874F0]"
                  >
                    <option value="all">
                      All deals
                    </option>

                    <option value="10-plus">
                      10%+ off
                    </option>

                    <option value="20-plus">
                      20%+ off
                    </option>
                  </select>

                  <select
                    value={sort}
                    onChange={(event) =>
                      setSort(
                        event.target.value,
                      )
                    }
                    className="h-11 rounded-md border border-[#E0E0E0] bg-white px-3 text-sm outline-none focus:border-[#2874F0]"
                  >
                    <option value="discount">
                      Biggest discount
                    </option>

                    <option value="ending">
                      Ending soon
                    </option>

                    <option value="price-low">
                      Lowest price
                    </option>

                    <option value="price-high">
                      Highest price
                    </option>
                  </select>

                  {(search ||
                    filter !== "all" ||
                    sort !== "discount") && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex h-11 items-center gap-1 rounded-md px-3 text-sm font-semibold text-[#2874F0] hover:bg-[#EAF2FF]"
                    >
                      <X size={14} />
                      Clear
                    </button>
                  )}

                </div>

              </div>

              <div className="mt-3 text-xs text-[#878787]">
                Showing{" "}
                <span className="font-semibold text-[#212121]">
                  {filteredDeals.length}
                </span>{" "}
                active{" "}
                {filteredDeals.length === 1
                  ? "deal"
                  : "deals"}
              </div>

            </section>


            {/* =================================================
                DEAL GRID
            ================================================= */}

            {filteredDeals.length ? (
              <section>

                <div className="mb-4 flex items-center justify-between">

                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2874F0]">
                      Current offers
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-[#212121]">
                      Deals worth checking out
                    </h2>
                  </div>

                </div>


                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

                  {filteredDeals.map(
                    ({
                      product,
                      discount,
                      discountedPrice,
                      discountPercentage,
                    }) => (
                      <article
                        key={`${product.id}-${discount.id}`}
                        className="relative min-w-0"
                      >

                        {/* Discount badge */}
                        <div className="absolute left-3 top-3 z-20 rounded-md bg-[#2874F0] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm">
                          {getDiscountLabel(
                            discount,
                          )}
                        </div>

                        <ProductCard
                          product={{
                            ...product,
                            price:
                              discountedPrice,
                          }}
                          imageUrl={
                            images[product.id]
                          }
                        />

                        {/* Pricing */}
                        <div className="mt-2 flex items-center justify-between gap-2 px-1">

                          <div className="flex min-w-0 items-center gap-2">

                            <span className="truncate text-sm font-bold text-[#2874F0]">
                              <Price
                                value={
                                  discountedPrice
                                }
                              />
                            </span>

                            <span className="shrink-0 text-xs text-[#878787] line-through">
                              <Price
                                value={
                                  product.price
                                }
                              />
                            </span>

                          </div>

                          <span className="shrink-0 text-[11px] font-semibold text-[#388E3C]">
                            {Math.round(
                              discountPercentage,
                            )}
                            % off
                          </span>

                        </div>


                        {/* Expiry */}
                        <div className="mt-2 flex items-center gap-1 px-1 text-[11px] text-[#878787]">

                          <Clock3 size={12} />

                          Ends{" "}
                          {new Date(
                            discount.end_date,
                          ).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                            },
                          )}

                        </div>

                      </article>
                    ),
                  )}

                </div>

              </section>
            ) : (
              <div className="rounded-lg border border-[#E0E0E0] bg-white px-6 py-16 text-center">

                <Search
                  size={24}
                  className="mx-auto text-[#2874F0]"
                />

                <h2 className="mt-4 text-lg font-semibold text-[#212121]">
                  No deals found
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#878787]">
                  Try another search or clear your
                  filters to see all current offers.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-semibold !text-white transition hover:bg-[#1F65D6]"
                >
                  Clear filters
                </button>

              </div>
            )}


            {/* =================================================
                BOTTOM CTA
            ================================================= */}

            <section className="mt-8 rounded-lg bg-white px-6 py-6 ring-1 ring-[#E0E0E0] sm:px-7">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h3 className="font-semibold text-[#212121]">
                    Looking for something else?
                  </h3>

                  <p className="mt-1 text-sm text-[#878787]">
                    Explore the complete {siteName} collection.
                  </p>
                </div>

                <Link
                  to="/shop"
                  className="inline-flex w-fit items-center gap-2 rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-semibold !text-white transition hover:bg-[#1F65D6]"
                >
                  Browse all products
                  <ArrowRight size={15} />
                </Link>

              </div>

            </section>

          </>
        )}

      </div>
    </main>
  );
}

export default Deals;