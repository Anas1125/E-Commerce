import {
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRight, Clock3, Search, Tag, X } from "lucide-react";
import { Link } from "react-router-dom";

import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import { EmptyState, LoadingState, Price } from "../components/Storefront";
import { SiteBrandingContext } from "../context/site-branding-context";
import api from "../services/api";

const PAGE_SIZE = 24;
const IMAGE_REQUEST_BATCH_SIZE = 6;

function sameId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function getProductPrice(product) {
  const price = Number(product.price);

  return Number.isFinite(price) ? price : 0;
}

function getProductCategoryId(product) {
  return product.category_id ?? product.category?.id ?? product.categoryId ?? null;
}

function getBrandName(product) {
  if (typeof product.brand === "string") return product.brand;

  return product.brand?.name ?? product.brand_name ?? "";
}

function getInlineImageUrl(product) {
  return (
    product.primary_image_url ??
    product.primary_image?.image_url ??
    product.image_url ??
    null
  );
}

function getDiscountAmount(discount, product) {
  const price = getProductPrice(product);

  if (price <= 0) return 0;

  const value = Number(discount.value) || 0;

  if (discount.discount_type === "percentage") {
    return Math.min(price, price * (value / 100));
  }

  if (discount.discount_type === "fixed") {
    return Math.min(price, value);
  }

  return 0;
}

function discountAppliesToProduct(discount, product) {
  if (discount.product_id != null) {
    return sameId(discount.product_id, product.id);
  }

  if (discount.category_id != null) {
    return sameId(discount.category_id, getProductCategoryId(product));
  }

  return true;
}

function getBestDiscount(product, discounts) {
  let best = null;
  let bestAmount = 0;

  for (const discount of discounts) {
    if (!discountAppliesToProduct(discount, product)) continue;

    const amount = getDiscountAmount(discount, product);

    if (amount > bestAmount) {
      best = discount;
      bestAmount = amount;
    }
  }

  return best;
}

function getDiscountLabel(discount, product) {
  if (discount.discount_type === "percentage") {
    return `${Number(discount.value)}% OFF`;
  }

  // Never advertise more than the product actually costs.
  return `₹${getDiscountAmount(discount, product).toLocaleString("en-IN")} OFF`;
}

function getEndTime(discount) {
  if (!discount.end_date) return Number.POSITIVE_INFINITY;

  const time = new Date(discount.end_date).getTime();

  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function isDiscountActive(discount, now) {
  if (!discount.is_active) return false;

  const startsAt = discount.start_date ? new Date(discount.start_date).getTime() : 0;
  const endsAt = getEndTime(discount);

  if (Number.isNaN(startsAt)) return false;

  return startsAt <= now && endsAt >= now;
}

function formatEndDate(discount) {
  if (!discount.end_date) return "";

  const date = new Date(discount.end_date);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getErrorMessage(requestError) {
  const detail = requestError?.response?.data?.detail;

  return typeof detail === "string" && detail
    ? detail
    : "Unable to load current offers.";
}

function useProductImages(products) {
  const [fetched, setFetched] = useState({});
  const requestedRef = useRef(new Set());

  useEffect(() => {
    const missing = products
      .filter((product) => !getInlineImageUrl(product))
      .map((product) => Number(product.id))
      .filter((id) => Number.isFinite(id) && !requestedRef.current.has(id));

    if (!missing.length) return undefined;

    let alive = true;

    missing.forEach((id) => requestedRef.current.add(id));

    async function loadImages() {
      for (let i = 0; i < missing.length; i += IMAGE_REQUEST_BATCH_SIZE) {
        const batch = missing.slice(i, i + IMAGE_REQUEST_BATCH_SIZE);

        const loaded = await Promise.all(
          batch.map(async (productId) => {
            try {
              const response = await api.get(`/products/${productId}/images`);
              const productImages = Array.isArray(response.data) ? response.data : [];

              const image =
                productImages.find((item) => item.is_primary) || productImages[0];

              return [productId, image?.image_url || null];
            } catch {
              return [productId, null];
            }
          }),
        );

        if (!alive) {
          // Let a later run request everything that never got fetched.
          missing.slice(i).forEach((id) => requestedRef.current.delete(id));
          return;
        }

        const found = Object.fromEntries(loaded.filter(([, url]) => Boolean(url)));

        if (Object.keys(found).length) {
          setFetched((current) => ({ ...current, ...found }));
        }
      }
    }

    loadImages();

    return () => {
      alive = false;
    };
  }, [products]);

  return useMemo(() => {
    const map = {};

    products.forEach((product) => {
      const url = getInlineImageUrl(product) || fetched[product.id];

      if (url) map[product.id] = url;
    });

    return map;
  }, [products, fetched]);
}

function Deals() {
  const { siteName = "TerraLens" } = useContext(SiteBrandingContext);

  const [discounts, setDiscounts] = useState([]);
  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("discount");
  const [filter, setFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let alive = true;

    async function loadDeals() {
      try {
        const [discountResponse, productResponse] = await Promise.all([
          api.get("/discounts/active"),
          api.get("/products/"),
        ]);

        if (!alive) return;

        const now = Date.now();

        setDiscounts(
          (discountResponse.data || []).filter((discount) =>
            isDiscountActive(discount, now),
          ),
        );
        setProducts(productResponse.data || []);
        setLoading(false);
      } catch (requestError) {
        if (!alive) return;

        setError(getErrorMessage(requestError));
        setLoading(false);
      }
    }

    loadDeals();

    return () => {
      alive = false;
    };
  }, []);

  const dealProducts = useMemo(() => {
    const result = [];

    products.forEach((product) => {
      const discount = getBestDiscount(product, discounts);

      if (!discount) return;

      const price = getProductPrice(product);
      const amount = getDiscountAmount(discount, product);

      result.push({
        product,
        discount,
        discountedPrice: Math.max(0, price - amount),
        discountPercentage: price > 0 ? (amount / price) * 100 : 0,
      });
    });

    return result;
  }, [products, discounts]);

  const highestDiscount = useMemo(
    () => dealProducts.reduce((highest, deal) => Math.max(highest, deal.discountPercentage), 0),
    [dealProducts],
  );

  const filteredDeals = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    const minimumPercentage = filter === "20-plus" ? 20 : filter === "10-plus" ? 10 : 0;

    const result = dealProducts.filter(({ product, discount, discountPercentage }) => {
      if (discountPercentage < minimumPercentage) return false;

      if (!query) return true;

      return [product.name, getBrandName(product), discount.name].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      );
    });

    if (sort === "discount") {
      result.sort((a, b) => b.discountPercentage - a.discountPercentage);
    }

    if (sort === "price-low") {
      result.sort((a, b) => a.discountedPrice - b.discountedPrice);
    }

    if (sort === "price-high") {
      result.sort((a, b) => b.discountedPrice - a.discountedPrice);
    }

    if (sort === "ending") {
      result.sort((a, b) => {
        const aEnd = getEndTime(a.discount);
        const bEnd = getEndTime(b.discount);

        if (aEnd === bEnd) return 0;

        return aEnd < bEnd ? -1 : 1;
      });
    }

    return result;
  }, [dealProducts, deferredSearch, sort, filter]);

  const filterSignature = [deferredSearch.trim(), sort, filter].join("|");

  const [pageState, setPageState] = useState({ signature: "", count: PAGE_SIZE });

  const visibleCount =
    pageState.signature === filterSignature ? pageState.count : PAGE_SIZE;

  const visibleDeals = useMemo(
    () => filteredDeals.slice(0, visibleCount),
    [filteredDeals, visibleCount],
  );

  const visibleProducts = useMemo(
    () => visibleDeals.map(({ product }) => product),
    [visibleDeals],
  );

  const images = useProductImages(visibleProducts);

  const showMore = () => {
    setPageState({ signature: filterSignature, count: visibleCount + PAGE_SIZE });
  };

  const clearFilters = () => {
    setSearch("");
    setSort("discount");
    setFilter("all");
  };

  const hasFilters = Boolean(search) || filter !== "all" || sort !== "discount";

  const hasDeals = dealProducts.length > 0;

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
                Save more on products currently available at special prices.
              </p>
            </div>

            {!loading && !error && hasDeals && (
              <div className="flex gap-3">
                <div className="rounded-md border border-[#E0E0E0] bg-[#FAFAFA] px-5 py-3">
                  <p className="text-xl font-bold text-[#212121]">{dealProducts.length}</p>

                  <p className="text-xs text-[#878787]">
                    {dealProducts.length === 1 ? "product on offer" : "products on offer"}
                  </p>
                </div>

                <div className="rounded-md bg-[#EAF2FF] px-5 py-3">
                  <p className="text-xl font-bold text-[#2874F0]">
                    {Math.round(highestDiscount)}%
                  </p>

                  <p className="text-xs text-[#2874F0]">maximum savings</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {loading ? (
          <LoadingState label="Finding the latest offers..." />
        ) : error ? (
          <EmptyState title="Offers unavailable" text={error} />
        ) : !hasDeals ? (
          <EmptyState
            title="No active offers right now"
            text="Our deals change from time to time. Check back soon or browse the full collection."
            action="Explore the shop"
            to="/shop"
          />
        ) : (
          <>
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
                    Explore current {siteName} discounts before the offers end.
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

            <section className="mb-5 rounded-lg bg-white p-4 sm:p-5">
              <div className="flex flex-col gap-3 lg:flex-row">
                {/* Search */}
                <div className="relative flex-1" role="search">
                  <Search
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#878787]"
                  />

                  <input
                    type="search"
                    aria-label="Search deals"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search deals, products or brands..."
                    className="h-11 w-full rounded-md border border-[#E0E0E0] bg-white pl-10 pr-10 text-sm outline-none transition focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]/20"
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#878787] hover:text-[#212121]"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Controls */}
                <div className="flex flex-wrap gap-2">
                  <select
                    aria-label="Filter by discount size"
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                    className="h-11 rounded-md border border-[#E0E0E0] bg-white px-3 text-sm outline-none focus:border-[#2874F0]"
                  >
                    <option value="all">All deals</option>
                    <option value="10-plus">10%+ off</option>
                    <option value="20-plus">20%+ off</option>
                  </select>

                  <select
                    aria-label="Sort deals"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    className="h-11 rounded-md border border-[#E0E0E0] bg-white px-3 text-sm outline-none focus:border-[#2874F0]"
                  >
                    <option value="discount">Biggest discount</option>
                    <option value="ending">Ending soon</option>
                    <option value="price-low">Lowest price</option>
                    <option value="price-high">Highest price</option>
                  </select>

                  {hasFilters && (
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

              <div className="mt-3 text-xs text-[#878787]" aria-live="polite">
                Showing{" "}
                <span className="font-semibold text-[#212121]">{filteredDeals.length}</span>{" "}
                active {filteredDeals.length === 1 ? "deal" : "deals"}
              </div>
            </section>

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
                  {visibleDeals.map(
                    ({ product, discount, discountedPrice, discountPercentage }) => {
                      const endDate = formatEndDate(discount);

                      return (
                        <article
                          key={`${product.id}-${discount.id}`}
                          className="relative min-w-0"
                        >
                          {/* Discount badge */}
                          <div className="absolute left-3 top-3 z-20 rounded-md bg-[#2874F0] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm">
                            {getDiscountLabel(discount, product)}
                          </div>

                          <ProductCard
                            product={{ ...product, price: discountedPrice }}
                            imageUrl={images[product.id]}
                          />

                          {/* Pricing */}
                          <div className="mt-2 flex items-center justify-between gap-2 px-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-bold text-[#2874F0]">
                                <Price value={discountedPrice} />
                              </span>

                              <span className="shrink-0 text-xs text-[#878787] line-through">
                                <Price value={product.price} />
                              </span>
                            </div>

                            <span className="shrink-0 text-[11px] font-semibold text-[#388E3C]">
                              {Math.round(discountPercentage)}% off
                            </span>
                          </div>

                          {/* Expiry */}
                          {endDate && (
                            <div className="mt-2 flex items-center gap-1 px-1 text-[11px] text-[#878787]">
                              <Clock3 size={12} />
                              Ends {endDate}
                            </div>
                          )}
                        </article>
                      );
                    },
                  )}
                </div>

                {filteredDeals.length > visibleDeals.length && (
                  <div className="mt-6 flex flex-col items-center gap-2">
                    <p className="text-xs text-[#878787]">
                      Showing {visibleDeals.length} of {filteredDeals.length}
                    </p>

                    <button
                      type="button"
                      onClick={showMore}
                      className="cursor-pointer rounded-md border border-[#2874F0] bg-white px-6 py-2.5 text-sm font-semibold text-[#2874F0] transition hover:bg-[#EAF2FF]"
                    >
                      Show more deals
                    </button>
                  </div>
                )}
              </section>
            ) : (
              <div className="rounded-lg border border-[#E0E0E0] bg-white px-6 py-16 text-center">
                <Search size={24} className="mx-auto text-[#2874F0]" />

                <h2 className="mt-4 text-lg font-semibold text-[#212121]">No deals found</h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#878787]">
                  Try another search or clear your filters to see all current offers.
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

            <section className="mt-8 rounded-lg bg-white px-6 py-6 ring-1 ring-[#E0E0E0] sm:px-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-[#212121]">Looking for something else?</h3>

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