import { useEffect, useMemo, useState,  useContext } from "react";
import { useSearchParams } from "react-router-dom";
import { SiteBrandingContext } from "../context/site-branding-context";

import {
  smartSearch,
} from "../utils/search";

import {
  Check,
  ChevronDown,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import ProductCard from "../components/ProductCard";
import api, { resolveMediaUrl } from "../services/api";
import SEO from "../components/SEO";

import {
  EmptyState,
  LoadingState,
} from "../components/Storefront";

function Shop() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brandsData, setBrandsData] = useState([]);
  const [images, setImages] = useState({});
  const { siteName = "TerraLens" } = useContext(
    SiteBrandingContext,
  );

  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") || "";

  const setSearch = (value) => {
    const nextParams = new URLSearchParams(searchParams);

    if (value.trim()) {
      nextParams.set("search", value);
    } else {
      nextParams.delete("search");
    }

    setSearchParams(nextParams, { replace: true });
  };
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
      api.get("/brands/"),
    ])
      .then(async ([productResponse, categoryResponse, brandResponse]) => {
        if (!alive) return;

        const productData = productResponse.data;
        const categoryData = categoryResponse.data;
        const brandData = brandResponse.data;

        setProducts(productData);
        setCategories(categoryData);
        setBrandsData(brandData);

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
      [...brandsData].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [brandsData],
  );

  const categoryMap = useMemo(
    () =>
      Object.fromEntries(
        categories.map((item) => [
          String(item.id),
          {
            name: item.name || "",
            slug: item.slug || "",
            description: item.description || "",
          },
        ]),
      ),
    [categories],
  );

  const filtered = useMemo(() => {
    let results = [...products];

    if (search.trim()) {
      results = smartSearch(
        results,
        search,
        (product) => {
          const productCategory =
            categoryMap[String(product.category_id)] || {};

          return [
            // Product information
            product.name,
            product.brand?.name || product.brand,
            product.description,

            // Category information
            productCategory.name,
            productCategory.slug,
            productCategory.description,

            // Existing category fields, if available
            product.category?.name,
            product.category?.slug,
            product.category_name,
          ];
        },
        25,
      );
    }

    if (category !== "all") {
      results = results.filter(
        (product) =>
          String(product.category_id) === category,
      );
    }

    if (brand !== "all") {
      results = results.filter(
        (product) => {
          const productBrand =
            product.brand?.name ||
            product.brand ||
            "";

          return productBrand === brand;
        },
      );
    }

    if (minPrice !== "") {
      results = results.filter(
        (product) =>
          Number(product.price) >=
          Number(minPrice),
      );
    }

    if (maxPrice !== "") {
      results = results.filter(
        (product) =>
          Number(product.price) <=
          Number(maxPrice),
      );
    }

    if (availability === "in") {
      results = results.filter(
        (product) => Number(product.stock) > 0,
      );
    }

    if (availability === "out") {
      results = results.filter(
        (product) => Number(product.stock) <= 0,
      );
    }

    if (sort === "low") {
      results.sort(
        (a, b) =>
          Number(a.price) - Number(b.price),
      );
    }

    if (sort === "high") {
      results.sort(
        (a, b) =>
          Number(b.price) - Number(a.price),
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
        (a, b) =>
          Number(b.id) - Number(a.id),
      );
    }

    return results;
    }, [
      products,
      categoryMap,
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

  const renderFilters = () => (
    <div className="space-y-6">
      {/* Category */}
      <div>
        <label
          htmlFor="shop-category"
          className="mb-2 block text-xs font-semibold text-[#212121]"
        >
          Category
        </label>

        <div className="relative">
          <select
            id="shop-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-11 w-full cursor-pointer appearance-none rounded-md border border-[#D8D8D8] bg-white px-4 pr-11 text-sm text-[#212121] outline-none transition focus:border-[#2874F0] focus:ring-2 focus:ring-[#2874F0]/10"
          >
            <option value="all">All categories</option>

            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <ChevronDown
            size={18}
            strokeWidth={2}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#555]"
          />
        </div>
      </div>

      {/* Brand */}
      <div>
        <label
          htmlFor="shop-brand"
          className="mb-2 block text-xs font-semibold text-[#212121]"
        >
          Brand
        </label>

        <div className="relative">
          <select
            id="shop-brand"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            className="h-11 w-full cursor-pointer appearance-none rounded-md border border-[#D8D8D8] bg-white px-4 pr-11 text-sm text-[#212121] outline-none transition focus:border-[#2874F0] focus:ring-2 focus:ring-[#2874F0]/10"
          >
            <option value="all">All brands</option>

            {brands.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>

          <ChevronDown
            size={18}
            strokeWidth={2}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#555]"
          />
        </div>
      </div>

      {/* Price */}
      <div>
        <p className="mb-2 text-xs font-semibold text-[#212121]">
          Price
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#878787]">
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
              className="h-10 w-full rounded-md border border-[#E0E0E0] bg-white pl-7 pr-2 text-sm outline-none focus:border-[#2874F0]"
            />
          </div>

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#878787]">
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
              className="h-10 w-full rounded-md border border-[#E0E0E0] bg-white pl-7 pr-2 text-sm outline-none focus:border-[#2874F0]"
            />
          </div>
        </div>
      </div>

      {/* Availability */}
      <div>
        <p className="mb-2 text-xs font-semibold text-[#212121]">
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
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                availability === value
                  ? "bg-[#EAF2FF] font-medium text-[#2874F0]"
                  : "text-[#555] hover:bg-[#F5F5F5]"
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
          className="flex w-full items-center justify-center gap-2 rounded-md border border-[#E0E0E0] bg-white py-2.5 text-sm font-medium text-[#555] transition hover:border-[#2874F0] hover:text-[#2874F0] cursor-pointer"
        >
          <X size={14} />
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    
    <main className="min-h-screen bg-[#F1F3F6]">
      <SEO
        title="Shop"
        description={`Browse products from ${siteName}. Find products across categories and brands with secure checkout and reliable delivery.`}
      />
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">

        {/* Page heading */}
        <section className="mb-5 rounded-lg bg-white px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold text-[#212121] sm:text-3xl">
              Shop
            </h1>

            <p className="text-sm text-[#878787]">
              Explore products from brands you know and
              discover something new.
            </p>
          </div>
        </section>

        {/* Shop by Brand */}
        {!loading && brands.length > 0 && (
          <section className="mb-5 overflow-hidden rounded-lg bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between border-b border-[#EEEEEE] px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[#212121]">
                  Shop by Brand
                </h2>

                <p className="mt-0.5 text-xs text-[#878787]">
                  Browse products from your favorite brands
                </p>
              </div>

              {brand !== "all" && (
                <button
                  type="button"
                  onClick={() => setBrand("all")}
                  className="text-xs font-medium text-[#2874F0] hover:underline"
                >
                  View all
                </button>
              )}
            </div>

            <div className="flex gap-3 overflow-x-auto px-5 py-4 scrollbar-hide sm:px-6">
              {/* All brands */}
              <button
                type="button"
                onClick={() => setBrand("all")}
                className={`flex min-w-[118px] shrink-0 flex-col items-center justify-center rounded-lg border px-4 py-3 transition ${
                  brand === "all"
                    ? "border-[#2874F0] bg-[#EAF2FF]"
                    : "border-[#E0E0E0] bg-white hover:border-[#2874F0]"
                }`}
              >
                <div
                  className={`flex h-12 w-16 items-center justify-center rounded-md text-sm font-bold ${
                    brand === "all"
                      ? "bg-[#2874F0] text-white"
                      : "bg-[#F1F3F6] text-[#555]"
                  }`}
                >
                  All
                </div>

                <span
                  className={`mt-2 text-xs font-medium ${
                    brand === "all"
                      ? "text-[#2874F0]"
                      : "text-[#212121]"
                  }`}
                >
                  All Brands
                </span>
              </button>

              {/* Real brands */}
              {brands.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setBrand(item.name)}
                  className={`flex min-w-[118px] shrink-0 flex-col items-center justify-center rounded-lg border px-4 py-3 transition ${
                    brand === item.name
                      ? "border-[#2874F0] bg-[#EAF2FF]"
                      : "border-[#E0E0E0] bg-white hover:border-[#2874F0]"
                  }`}
                >
                  <div className="flex h-12 w-16 items-center justify-center overflow-hidden rounded-md bg-white">
                    {item.logo_url ? (
                      <img
                        src={resolveMediaUrl(item.logo_url)}
                        alt={`${item.name} logo`}
                        className="max-h-10 max-w-[60px] object-contain"
                      />
                    ) : (
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold ${
                          brand === item.name
                            ? "bg-[#2874F0] text-white"
                            : "bg-[#F1F3F6] text-[#2874F0]"
                        }`}
                      >
                        {item.name
                          ?.trim()
                          ?.charAt(0)
                          ?.toUpperCase() || "B"}
                      </span>
                    )}
                  </div>

                  <span
                    className={`mt-2 max-w-[100px] truncate text-xs font-medium ${
                      brand === item.name
                        ? "text-[#2874F0]"
                        : "text-[#212121]"
                    }`}
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Search + controls */}
        <section className="mb-5 rounded-lg bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row">

            {/* Search */}
            <div className="relative min-w-0 flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#878787]"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search for products, brands and more"
                className="h-11 w-full rounded-md border border-[#E0E0E0] bg-white pl-10 pr-10 text-sm text-[#212121] outline-none transition focus:border-[#2874F0]"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#878787] hover:text-[#212121]"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="flex gap-2">
              {/* Mobile filter */}
              <button
                type="button"
                onClick={() => setShowFilters(true)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#E0E0E0] bg-white px-4 text-sm font-medium text-[#212121] lg:hidden"
              >
                <SlidersHorizontal size={16} />
                Filters

                {activeFilterCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2874F0] px-1.5 text-[10px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Sort */}
              <div className="relative">
                <label className="relative flex h-11 items-center gap-2 rounded-md border border-[#E0E0E0] bg-white px-3 text-sm">
                  <span className="text-[#878787]">
                    Sort:
                  </span>

                  <select
                    aria-label="Sort products"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    className="w-full cursor-pointer appearance-none bg-transparent pr-7 font-medium text-[#212121] outline-none"
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

                  <ChevronDown
                    size={14}
                    className="pointer-events-none absolute right-3 text-[#878787]"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Active filters */}
          {(selectedCategoryName ||
            brand !== "all" ||
            minPrice ||
            maxPrice ||
            availability !== "all") && (
            <div className="mt-3 flex flex-wrap items-center gap-2">

              {selectedCategoryName && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EAF2FF] px-2.5 py-1.5 text-xs font-medium text-[#2874F0]">
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
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EAF2FF] px-2.5 py-1.5 text-xs font-medium text-[#2874F0]">
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
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EAF2FF] px-2.5 py-1.5 text-xs font-medium text-[#2874F0]">
                  ₹{minPrice || "0"} – ₹
                  {maxPrice || "∞"}

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
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EAF2FF] px-2.5 py-1.5 text-xs font-medium text-[#2874F0] cursor-pointer">
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

              <button
                type="button"
                onClick={clearFilters}
                className="ml-1 text-xs font-medium text-[#2874F0] hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </section>

        {/* Results header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#212121]">
              {brand !== "all"
                ? `${brand} Products`
                : "All Products"}
            </h2>

            <p className="mt-0.5 text-xs text-[#878787]">
              {loading
                ? "Loading products..."
                : `${filtered.length} ${
                    filtered.length === 1
                      ? "product"
                      : "products"
                  }`}
            </p>
          </div>
        </div>

        {/* Main content */}
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">

          {/* Desktop filters */}
          <aside className="sticky top-24 hidden h-fit max-h-[calc(100vh-7rem)] overflow-y-auto rounded-lg bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:block">
            <div className="border-b border-[#EEEEEE] px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#212121]">
                    Filters
                  </p>

                  <p className="mt-0.5 text-xs text-[#878787]">
                    Refine your products
                  </p>
                </div>

                <Filter
                  size={17}
                  className="text-[#2874F0]"
                />
              </div>
            </div>

            <div className="p-4">
              {renderFilters()}
            </div>
          </aside>

          {/* Products */}
          <section className="min-w-0">
            {loading ? (
              <div className="rounded-lg bg-white p-6">
                <LoadingState />
              </div>
            ) : error ? (
              <div className="rounded-lg bg-white p-6">
                <EmptyState
                  title="Shop unavailable"
                  text="We couldn't load products. Please try again."
                />
              </div>
            ) : filtered.length ? (

              <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {filtered.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    imageUrl={images[product.id]}
                  />
                ))}
              </div>

            ) : (
              <div className="rounded-lg bg-white px-6 py-20 text-center">
                <Search
                  size={28}
                  className="mx-auto text-[#2874F0]"
                />

                <h2 className="mt-4 text-lg font-semibold text-[#212121]">
                  No products found
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#878787]">
                  Try changing your search or removing one
                  of the filters.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-md bg-[#2874F0] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1F65D6]"
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-black/40"
            aria-label="Close filters"
            onClick={() => setShowFilters(false)}
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filter-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-[#F1F3F6] shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-[#E0E0E0] bg-white px-5 py-4">
              <div>
                <p className="text-xs font-medium text-[#2874F0]">
                  Refine products
                </p>

                <h2
                  id="mobile-filter-title"
                  className="mt-0.5 text-lg font-semibold text-[#212121]"
                >
                  Filters
                </h2>
              </div>

              <button
                type="button"
                className="rounded-full p-2 text-[#555] hover:bg-[#F1F3F6]"
                aria-label="Close filters"
                onClick={() => setShowFilters(false)}
              >
                <X size={19} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
              {renderFilters()}
            </div>

            <div className="border-t border-[#E0E0E0] bg-white p-4">
              <button
                type="button"
                className="w-full rounded-md bg-[#2874F0] py-3 text-sm font-semibold text-white transition hover:bg-[#1F65D6]"
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