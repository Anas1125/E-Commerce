import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import ProductCard from "../components/ProductCard";
import api from "../services/api";
import {
  EmptyState,
  LoadingState,
  PageIntro,
} from "../components/Storefront";

function Shop() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState({});

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [availability, setAvailability] = useState("all");
  const [sort, setSort] = useState("default");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let alive = true;

    Promise.all([
      api.get("/products/"),
      api.get("/categories/"),
    ])
      .then(async ([productResponse, categoryResponse]) => {
        if (!alive) return;

        const productData = productResponse.data;
        const categoryData = categoryResponse.data;

        setProducts(productData);
        setCategories(categoryData);

        const imageResults = await Promise.all(
          productData.map(async (product) => {
            try {
              const response = await api.get(
                `/products/${product.id}/images`,
              );

              const image =
                response.data.find((item) => item.is_primary) ||
                response.data[0];

              return [
                product.id,
                image?.image_url || null,
              ];
            } catch {
              return [product.id, null];
            }
          }),
        );

        if (alive) {
          setImages(
            Object.fromEntries(
              imageResults.filter(([, url]) => url),
            ),
          );
        }
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const brands = useMemo(
    () =>
      [
        ...new Set(
          products
            .map((product) => product.brand)
            .filter(Boolean),
        ),
      ].sort(),
    [products],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const results = products.filter((product) => {
      const text =
        `${product.name} ${product.brand || ""} ${
          product.description || ""
        }`.toLowerCase();

      const availableStock = Number(
        product.available_stock ??
          product.stock ??
          0,
      );

      return (
        (!query || text.includes(query)) &&
        (category === "all" ||
          String(product.category_id) === category) &&
        (brand === "all" || product.brand === brand) &&
        (minPrice === "" ||
          Number(product.price) >= Number(minPrice)) &&
        (maxPrice === "" ||
          Number(product.price) <= Number(maxPrice)) &&
        (availability === "all" ||
          (availability === "in"
            ? availableStock > 0
            : availableStock <= 0))
      );
    });

    if (sort === "low") {
      results.sort(
        (a, b) => Number(a.price) - Number(b.price),
      );
    }

    if (sort === "high") {
      results.sort(
        (a, b) => Number(b.price) - Number(a.price),
      );
    }

    if (sort === "rating") {
      results.sort(
        (a, b) =>
          Number(b.rating || 0) -
          Number(a.rating || 0),
      );
    }

    if (sort === "new") {
      results.sort(
        (a, b) => Number(b.id) - Number(a.id),
      );
    }

    return results;
  }, [
    products,
    search,
    category,
    brand,
    minPrice,
    maxPrice,
    availability,
    sort,
  ]);

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setBrand("all");
    setMinPrice("");
    setMaxPrice("");
    setAvailability("all");
    setSort("default");
  };

  const hasFilters =
    search ||
    category !== "all" ||
    brand !== "all" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    availability !== "all";

  const activeFilterCount = [
    category !== "all",
    brand !== "all",
    minPrice !== "",
    maxPrice !== "",
    availability !== "all",
  ].filter(Boolean).length;

  const selectedCategoryName = categories.find(
    (item) => String(item.id) === category,
  )?.name;

  const renderFilters = (mobile = false) => (
    <div className="space-y-7">
      {/* Category */}
      <div>
        <label
          htmlFor={mobile ? "mobile-category" : "category"}
          className="mb-2.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-[#59645C]"
        >
          Category
        </label>

        <select
          id={mobile ? "mobile-category" : "category"}
          value={category}
          onChange={(event) =>
            setCategory(event.target.value)
          }
          className="h-11 w-full cursor-pointer rounded-xl border border-[#E3E5DF] bg-white px-3 text-sm text-[#1F2521] outline-none transition focus:border-[#486B57] focus:ring-2 focus:ring-[#486B57]/10"
        >
          <option value="all">All categories</option>

          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {/* Brand */}
      <div>
        <label
          htmlFor={mobile ? "mobile-brand" : "brand"}
          className="mb-2.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-[#59645C]"
        >
          Brand
        </label>

        <select
          id={mobile ? "mobile-brand" : "brand"}
          value={brand}
          onChange={(event) =>
            setBrand(event.target.value)
          }
          className="h-11 w-full cursor-pointer rounded-xl border border-[#E3E5DF] bg-white px-3 text-sm text-[#1F2521] outline-none transition focus:border-[#486B57] focus:ring-2 focus:ring-[#486B57]/10"
        >
          <option value="all">All brands</option>

          {brands.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {/* Price */}
      <div>
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#59645C]">
          Price range
        </p>

        <div className="grid min-w-0 grid-cols-2 gap-2">
          <div className="relative min-w-0">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A918B]">
              ₹
            </span>

            <input
              type="number"
              min="0"
              value={minPrice}
              onChange={(event) =>
                setMinPrice(event.target.value)
              }
              placeholder="Min"
              aria-label="Minimum price"
              className="h-11 w-full min-w-0 rounded-xl border border-[#E3E5DF] bg-white pl-7 pr-2 text-sm text-[#1F2521] outline-none transition placeholder:text-[#9AA19B] focus:border-[#486B57] focus:ring-2 focus:ring-[#486B57]/10"
            />
          </div>

          <div className="relative min-w-0">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A918B]">
              ₹
            </span>

            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(event) =>
                setMaxPrice(event.target.value)
              }
              placeholder="Max"
              aria-label="Maximum price"
              className="h-11 w-full min-w-0 rounded-xl border border-[#E3E5DF] bg-white pl-7 pr-2 text-sm text-[#1F2521] outline-none transition placeholder:text-[#9AA19B] focus:border-[#486B57] focus:ring-2 focus:ring-[#486B57]/10"
            />
          </div>
        </div>
      </div>

      {/* Availability */}
      <div>
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#59645C]">
          Availability
        </p>

        <div className="space-y-1">
          {[
            ["all", "All products"],
            ["in", "In stock"],
            ["out", "Out of stock"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setAvailability(value)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                availability === value
                  ? "bg-[#DCE7DE] font-medium text-[#385744]"
                  : "text-[#59645C] hover:bg-[#F5F5F1]"
              }`}
            >
              <span>{label}</span>

              {availability === value && (
                <Check size={15} />
              )}
            </button>
          ))}
        </div>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E3E5DF] bg-white py-2.5 text-sm font-medium text-[#59645C] transition hover:border-[#C8D5CA] hover:text-[#486B57]"
        >
          <X size={14} />
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-10 sm:py-12">
      {/* Header */}
      <PageIntro
        eyebrow="The collection"
        title="Shop"
        description="Explore considered essentials and finds for everyday living."
      />

      {/* Search + controls */}
      <section className="mt-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[#737A74]"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search products, brands or details..."
              className="h-12 w-full rounded-2xl border border-[#E3E5DF] bg-white pl-11 pr-10 text-sm text-[#1F2521] shadow-sm outline-none transition placeholder:text-[#9AA19B] focus:border-[#486B57] focus:ring-4 focus:ring-[#486B57]/5"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#737A74] transition hover:text-[#1F2521]"
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {/* Mobile filters */}
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#E3E5DF] bg-white px-4 text-sm font-medium text-[#59645C] shadow-sm transition hover:border-[#C8D5CA] hover:text-[#486B57] lg:hidden"
            >
              <SlidersHorizontal size={16} />
              Filters

              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#486B57] px-1.5 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Sort */}
            <div className="relative">
              <label className="flex h-12 items-center gap-2 rounded-2xl border border-[#E3E5DF] bg-white px-4 text-sm shadow-sm">
                <span className="text-[#737A74]">
                  Sort
                </span>

                <select
                  aria-label="Sort products"
                  value={sort}
                  onChange={(event) =>
                    setSort(event.target.value)
                  }
                  className="cursor-pointer appearance-none bg-transparent pr-5 font-medium text-[#1F2521] outline-none"
                >
                  <option value="default">
                    Recommended
                  </option>
                  <option value="low">
                    Price: Low to High
                  </option>
                  <option value="high">
                    Price: High to Low
                  </option>
                  <option value="rating">
                    Highest Rated
                  </option>
                  <option value="new">
                    Newest
                  </option>
                </select>
              </label>

              {/* ONE arrow only */}
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#737A74]">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* Active filters */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {selectedCategoryName && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCE7DE] px-3 py-1.5 text-xs font-medium text-[#385744]">
              {selectedCategoryName}

              <button
                type="button"
                onClick={() => setCategory("all")}
                aria-label="Remove category filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {brand !== "all" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCE7DE] px-3 py-1.5 text-xs font-medium text-[#385744]">
              {brand}

              <button
                type="button"
                onClick={() => setBrand("all")}
                aria-label="Remove brand filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {(minPrice || maxPrice) && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCE7DE] px-3 py-1.5 text-xs font-medium text-[#385744]">
              ₹{minPrice || "0"} – ₹{maxPrice || "∞"}

              <button
                type="button"
                onClick={() => {
                  setMinPrice("");
                  setMaxPrice("");
                }}
                aria-label="Remove price filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {availability !== "all" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCE7DE] px-3 py-1.5 text-xs font-medium text-[#385744]">
              {availability === "in"
                ? "In stock"
                : "Out of stock"}

              <button
                type="button"
                onClick={() =>
                  setAvailability("all")
                }
                aria-label="Remove availability filter"
              >
                <X size={12} />
              </button>
            </span>
          )}

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 text-xs font-medium text-[#737A74] transition hover:text-[#486B57]"
            >
              Clear all
            </button>
          )}
        </div>
      </section>

      {/* Results */}
      <div className="mt-8 flex items-end justify-between border-b border-[#E3E5DF] pb-4">
        <div>
          <p className="text-sm font-medium text-[#1F2521]">
            {loading
              ? "Loading products…"
              : `${filtered.length} ${
                  filtered.length === 1
                    ? "product"
                    : "products"
                }`}
          </p>

          <p className="mt-1 text-xs text-[#9AA19B]">
            {category !== "all"
              ? "Filtered collection"
              : "All products"}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Desktop filters */}
        <aside className="hidden h-fit rounded-2xl border border-[#E3E5DF] bg-white p-5 lg:block">
          <div className="mb-5 flex items-center justify-between border-b border-[#E3E5DF] pb-4">
            <div>
              <p className="text-sm font-semibold text-[#1F2521]">
                Filters
              </p>

              <p className="mt-1 text-xs text-[#737A74]">
                Refine your search
              </p>
            </div>

            <Filter
              size={17}
              className="text-[#486B57]"
            />
          </div>

          {renderFilters()}
        </aside>

        {/* Products */}
        <section className="min-w-0">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <EmptyState
              title="Shop unavailable"
              text="We couldn't load products. Please try again."
            />
          ) : filtered.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 lg:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  imageUrl={images[product.id]}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#D5DAD4] bg-white px-6 py-16 text-center">
              <Search
                size={24}
                className="mx-auto text-[#486B57]"
              />

              <h2 className="mt-4 text-lg font-semibold text-[#1F2521]">
                No products found
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#737A74]">
                Try changing your search or removing one
                of the filters.
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
        </section>
      </div>

      {/* Mobile filter drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-black/30 backdrop-blur-[2px]"
            aria-label="Close filters"
            onClick={() => setShowFilters(false)}
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filter-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-[#F8F8F5] shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-[#E3E5DF] bg-white px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#486B57]">
                  Refine
                </p>

                <h2
                  id="mobile-filter-title"
                  className="mt-1 text-lg font-semibold text-[#1F2521]"
                >
                  Filters
                </h2>
              </div>

              <button
                type="button"
                className="rounded-full p-2 text-[#59645C] transition hover:bg-[#F0F1EC]"
                aria-label="Close filters"
                onClick={() => setShowFilters(false)}
              >
                <X size={19} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {renderFilters(true)}
            </div>

            <div className="border-t border-[#E3E5DF] bg-white p-4">
              <button
                type="button"
                className="w-full rounded-xl bg-[#486B57] py-3 text-sm font-semibold text-white transition hover:bg-[#385744]"
                onClick={() => setShowFilters(false)}
              >
                Show {filtered.length}{" "}
                {filtered.length === 1
                  ? "product"
                  : "products"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default Shop;