import { useEffect, useMemo, useState } from "react";
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
import {
  EmptyState,
  LoadingState,
  PageIntro,
  Price,
} from "../components/Storefront";

function Deals() {
  const [discounts, setDiscounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [images, setImages] = useState({});

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("discount");
  const [filter, setFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    const loadDeals = async () => {
      try {
        setLoading(true);
        setError("");

        const [discountResponse, productResponse] = await Promise.all([
          api.get("/discounts/"),
          api.get("/products/"),
        ]);

        const now = Date.now();

        const activeDiscounts = discountResponse.data.filter(
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
                response.data.find((item) => item.is_primary) ||
                response.data[0];

              return [product.id, image?.image_url || null];
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

  const getDiscountAmount = (discount, product) => {
    if (!product) return 0;

    if (discount.discount_type === "percentage") {
      return (
        Number(product.price) * (Number(discount.value) / 100)
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

    return `₹${Number(discount.value).toLocaleString(
      "en-IN",
    )} OFF`;
  };

  const getDiscountPercentage = (discount, product) => {
    if (!product) return 0;

    if (discount.discount_type === "percentage") {
      return Number(discount.value);
    }

    if (!Number(product.price)) return 0;

    return (
      (Number(discount.value) / Number(product.price)) *
      100
    );
  };

  /*
   * Build one deal per product.
   *
   * Product-specific discounts take priority over a storewide
   * discount if both exist.
   */
  const dealProducts = useMemo(() => {
    const result = [];

    products.forEach((product) => {
      const specificDeal = discounts.find(
        (discount) => discount.product_id === product.id,
      );

      const storewideDeal = discounts.find(
        (discount) => discount.product_id === null,
      );

      const deal = specificDeal || storewideDeal;

      if (!deal) return;

      result.push({
        product,
        discount: deal,
        discountedPrice: getDiscountedPrice(deal, product),
        discountPercentage: getDiscountPercentage(
          deal,
          product,
        ),
      });
    });

    return result;
  }, [products, discounts]);

  const filteredDeals = useMemo(() => {
    const query = search.trim().toLowerCase();

    let result = dealProducts.filter(({ product, discount }) => {
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
          getDiscountPercentage(discount, product) >= 20
        );
      }

      if (filter === "10-plus") {
        return (
          getDiscountPercentage(discount, product) >= 10
        );
      }

      return true;
    });

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
        Math.max(highest, deal.discountPercentage),
      0,
    );
  }, [dealProducts]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:py-12">
      <PageIntro
        eyebrow="Limited-time offers"
        title="The Deals Edit"
        description="Discover current TerraLens offers and find something worth bringing home."
      />

      {loading ? (
        <LoadingState label="Finding the latest offers…" />
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
          {/* Deal Hero */}
          <section className="relative mb-10 overflow-hidden rounded-[1.75rem] bg-[#344D3E]">
            <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-[#76947F]/20 blur-3xl" />

            <div className="relative grid gap-8 px-7 py-9 sm:px-10 sm:py-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="max-w-2xl text-white">
                <div className="flex items-center gap-2 text-[#C6D5C8]">
                  <Tag size={15} />

                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                    Special offers
                  </p>
                </div>

                <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                  More value, thoughtfully chosen.
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
                  Explore products currently available with
                  active TerraLens discounts.
                </p>
              </div>

              <div className="flex gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-sm">
                  <p className="text-2xl font-semibold text-white">
                    {dealProducts.length}
                  </p>

                  <p className="mt-1 text-xs text-white/60">
                    products on offer
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4 backdrop-blur-sm">
                  <p className="text-2xl font-semibold text-white">
                    {Math.round(highestDiscount)}%
                  </p>

                  <p className="mt-1 text-xs text-white/60">
                    highest discount
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Deals toolbar */}
          <section className="mb-8">
            <div className="flex flex-col gap-4 border-b border-[#E3E5DF] pb-5 lg:flex-row lg:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search
                  size={17}
                  className="absolute left-0 top-1/2 -translate-y-1/2 text-[#737A74]"
                />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search deals or products..."
                  className="h-10 w-full border-0 bg-transparent pl-7 pr-8 text-sm text-[#1F2521] outline-none placeholder:text-[#9AA19B]"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737A74] transition-colors hover:text-[#1F2521]"
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className="h-9 rounded-full border border-[#E3E5DF] bg-white px-4 text-xs font-medium text-[#59645c] outline-none transition-colors hover:border-[#C8D5CA] focus:border-[#486B57]"
                >
                  <option value="all">All deals</option>
                  <option value="10-plus">10%+ off</option>
                  <option value="20-plus">20%+ off</option>
                </select>

                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="h-9 rounded-full border border-[#E3E5DF] bg-white px-4 text-xs font-medium text-[#59645c] outline-none transition-colors hover:border-[#C8D5CA] focus:border-[#486B57]"
                >
                  <option value="discount">Biggest discount</option>
                  <option value="ending">Ending soon</option>
                  <option value="price-low">Lowest price</option>
                  <option value="price-high">Highest price</option>
                </select>

                {(search ||
                  filter !== "all" ||
                  sort !== "discount") && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-[#737A74] transition-colors hover:bg-[#F5F5F1] hover:text-[#486B57]"
                  >
                    <X size={13} />
                    Clear
                  </button>
                )}
              </div>
            </div>

            <p className="mt-3 text-xs text-[#737A74]">
              Showing{" "}
              <span className="font-medium text-[#1F2521]">
                {filteredDeals.length}
              </span>{" "}
              active{" "}
              {filteredDeals.length === 1 ? "deal" : "deals"}
            </p>
          </section>

          {/* Deal Products */}
          {filteredDeals.length ? (
            <section>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {filteredDeals.map(
                  ({
                    product,
                    discount,
                    discountedPrice,
                    discountPercentage,
                  }) => (
                    <article
                      key={`${product.id}-${discount.id}`}
                      className="group relative"
                    >
                      {/* Discount badge */}
                      <div className="absolute left-3 top-3 z-20 rounded-full bg-[#486B57] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm">
                        {getDiscountLabel(discount)}
                      </div>

                      <ProductCard
                        product={{
                          ...product,
                          price: discountedPrice,
                        }}
                        imageUrl={images[product.id]}
                      />

                      {/* Price information */}
                      <div className="mt-2 flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#486B57]">
                            <Price value={discountedPrice} />
                          </span>

                          <span className="text-xs text-[#9AA19B] line-through">
                            <Price value={product.price} />
                          </span>
                        </div>

                        <span className="text-[11px] font-medium text-[#486B57]">
                          {Math.round(discountPercentage)}% saved
                        </span>
                      </div>

                      {/* Expiry */}
                      <div className="mt-2 flex items-center gap-1 px-1 text-[11px] text-[#8A918B]">
                        <Clock3 size={12} />

                        Ends{" "}
                        {new Date(
                          discount.end_date,
                        ).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                    </article>
                  ),
                )}
              </div>
            </section>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#D5DAD4] bg-white px-6 py-16 text-center">
              <Search
                size={22}
                className="mx-auto text-[#486B57]"
              />

              <h2 className="mt-4 text-lg font-semibold text-[#1F2521]">
                No deals found
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#737A74]">
                Try another search or clear your filters to
                see all current offers.
              </p>

              <button
                type="button"
                onClick={clearFilters}
                className="mt-6 rounded-full bg-[#486B57] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#385744]"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Bottom CTA */}
          <div className="mt-14 flex flex-col gap-4 border-t border-[#E3E5DF] pt-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1F2521]">
                Didn't find what you were looking for?
              </p>

              <p className="mt-1 text-sm text-[#737A74]">
                Explore everything available at TerraLens.
              </p>
            </div>

            <Link
              to="/shop"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-[#486B57] hover:text-[#385744]"
            >
              Browse the full collection
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default Deals;