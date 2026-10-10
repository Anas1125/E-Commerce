import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  ChevronDown,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import { EmptyState, LoadingState } from "../components/Storefront";
import { SiteBrandingContext } from "../context/site-branding-context";
import api, { resolveMediaUrl } from "../services/api";
import { smartSearch } from "../utils/search";

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 300;
const IMAGE_REQUEST_BATCH_SIZE = 6;

const AVAILABILITY_OPTIONS = [
  ["all", "All products"],
  ["in", "In stock"],
  ["out", "Out of stock"],
];

function getInlineImageUrl(product) {
  return (
    product.primary_image_url ??
    product.primary_image?.image_url ??
    product.image_url ??
    null
  );
}

function getBrandName(product) {
  if (typeof product.brand === "string") return product.brand;

  return product.brand?.name ?? product.brand_name ?? "";
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getProductDate(product) {
  const value =
    product.created_at ??
    product.createdAt ??
    product.created_on ??
    product.createdOn ??
    product.date_created ??
    null;

  if (!value) return 0;

  const timestamp = new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

const SELECT_CLASS =
  "h-11 w-full cursor-pointer appearance-none rounded-md border border-[#D8D8D8] bg-white px-4 pr-11 text-sm text-[#212121] outline-none transition focus:border-[#2874F0] focus:ring-2 focus:ring-[#2874F0]/10";

function FilterChip({ label, onRemove, removeLabel }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-[#EAF2FF] px-2.5 py-1.5 text-xs font-medium text-[#2874F0]">
      {label}

      <button type="button" onClick={onRemove} aria-label={removeLabel}>
        <X size={12} />
      </button>
    </span>
  );
}

function SelectField({ id, label, value, onChange, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-semibold text-[#212121]">
        {label}
      </label>

      <div className="relative">
        <select id={id} value={value} onChange={onChange} className={SELECT_CLASS}>
          {children}
        </select>

        <ChevronDown
          size={18}
          strokeWidth={2}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#555]"
        />
      </div>
    </div>
  );
}

function PriceInput({ value, onChange, placeholder, label }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#878787]">
        ₹
      </span>

      <input
        type="number"
        min="0"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 w-full rounded-md border border-[#E0E0E0] bg-white pl-7 pr-2 text-sm outline-none focus:border-[#2874F0]"
      />
    </div>
  );
}

function Shop() {
  const { siteName = "TerraLens" } = useContext(SiteBrandingContext);

  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") || "";
  const trimmedSearch = search.trim();

  const [searchInput, setSearchInput] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brandsData, setBrandsData] = useState([]);
  const [images, setImages] = useState({});

  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [availability, setAvailability] = useState("all");
  const [sort, setSort] = useState("default");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const requestedImagesRef = useRef(new Set());

  useEffect(() => {
    let alive = true;

    async function load() {
      const [productResult, categoryResult, brandResult] = await Promise.allSettled([
        api.get("/products/"),
        api.get("/categories/"),
        api.get("/brands/"),
      ]);

      if (!alive) return;

      if (productResult.status === "rejected") {
        setError(true);
        setLoading(false);
        return;
      }

      const productData = productResult.value.data || [];

      const inlineImages = {};

      productData.forEach((product) => {
        const url = getInlineImageUrl(product);

        if (url) {
          inlineImages[product.id] = url;
          requestedImagesRef.current.add(Number(product.id));
        }
      });

      setProducts(productData);
      setCategories(
        categoryResult.status === "fulfilled" ? categoryResult.value.data || [] : [],
      );
      setBrandsData(brandResult.status === "fulfilled" ? brandResult.value.data || [] : []);
      setImages(inlineImages);
      setLoading(false);
    }

    load().catch(() => {
      if (!alive) return;

      setError(true);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  const updateSearchParam = (value) => {
    const next = value.trim();

    setSearchParams(
      (previous) => {
        const nextParams = new URLSearchParams(previous);

        if (next) {
          nextParams.set("search", next);
        } else {
          nextParams.delete("search");
        }

        return nextParams;
      },
      { replace: true },
    );
  };

  if (search !== syncedSearch) {
    setSyncedSearch(search);

    if (searchInput.trim() !== trimmedSearch) {
      setSearchInput(search);
    }
  }

  useEffect(() => {
    if (searchInput.trim() === trimmedSearch) return undefined;

    const timer = window.setTimeout(() => {
      updateSearchParam(searchInput);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, trimmedSearch]);

  const clearSearch = () => {
    setSearchInput("");
    updateSearchParam("");
  };

  const brands = useMemo(
    () =>
      [...brandsData].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || "")),
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

    if (trimmedSearch) {
      results = smartSearch(
        results,
        trimmedSearch,
        (product) => {
          const productCategory = categoryMap[String(product.category_id)] || {};

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
        Math.max(results.length, 1),
      );
    }

    if (category !== "all") {
      results = results.filter((product) => String(product.category_id) === category);
    }

    if (brand !== "all") {
      const wanted = normalize(brand);

      results = results.filter((product) => normalize(getBrandName(product)) === wanted);
    }

    if (minPrice !== "") {
      results = results.filter((product) => Number(product.price) >= Number(minPrice));
    }

    if (maxPrice !== "") {
      results = results.filter((product) => Number(product.price) <= Number(maxPrice));
    }

    if (availability === "in") {
      results = results.filter((product) => Number(product.stock) > 0);
    }

    if (availability === "out") {
      results = results.filter((product) => Number(product.stock) <= 0);
    }

    if (sort === "low") {
      results.sort((a, b) => Number(a.price) - Number(b.price));
    }

    if (sort === "high") {
      results.sort((a, b) => Number(b.price) - Number(a.price));
    }

    if (sort === "rating") {
      results.sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
    }

    if (sort === "new") {
      results.sort((a, b) => {
        const dateDifference = getProductDate(b) - getProductDate(a);

        if (dateDifference !== 0) return dateDifference;

        return Number(b.id) - Number(a.id);
      });
    }

    return results;
  }, [
    products,
    categoryMap,
    trimmedSearch,
    category,
    brand,
    minPrice,
    maxPrice,
    availability,
    sort,
  ]);

  const filterSignature = [
    trimmedSearch,
    category,
    brand,
    minPrice,
    maxPrice,
    availability,
    sort,
  ].join("|");

  const [pageState, setPageState] = useState({ signature: "", count: PAGE_SIZE });

  const visibleCount =
    pageState.signature === filterSignature ? pageState.count : PAGE_SIZE;

  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const showMore = () => {
    setPageState({ signature: filterSignature, count: visibleCount + PAGE_SIZE });
  };

  useEffect(() => {
    const missing = visibleProducts
      .map((product) => Number(product.id))
      .filter((id) => Number.isFinite(id) && !requestedImagesRef.current.has(id));

    if (!missing.length) return undefined;

    let alive = true;

    missing.forEach((id) => requestedImagesRef.current.add(id));

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
          missing.slice(i).forEach((id) => requestedImagesRef.current.delete(id));
          return;
        }

        const found = Object.fromEntries(loaded.filter(([, url]) => Boolean(url)));

        if (Object.keys(found).length) {
          setImages((current) => ({ ...current, ...found }));
        }
      }
    }

    loadImages();

    return () => {
      alive = false;
    };
  }, [visibleProducts]);

  useEffect(() => {
    if (!showFilters) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") setShowFilters(false);
    };

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showFilters]);

  const clearFilters = () => {
    clearSearch();
    setCategory("all");
    setBrand("all");
    setMinPrice("");
    setMaxPrice("");
    setAvailability("all");
    setSort("default");
  };

  const hasFilters =
    Boolean(trimmedSearch) ||
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

  const productCountLabel = `${filtered.length} ${
    filtered.length === 1 ? "product" : "products"
  }`;

  const resultsTitle = trimmedSearch
    ? `Results for “${trimmedSearch}”`
    : brand !== "all"
      ? `${brand} Products`
      : "All Products";

  const renderFilters = () => (
    <div className="space-y-6">
      <SelectField
        id="shop-category"
        label="Category"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
      >
        <option value="all">All categories</option>

        {categories.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="shop-brand"
        label="Brand"
        value={brand}
        onChange={(event) => setBrand(event.target.value)}
      >
        <option value="all">All brands</option>

        {brands.map((item) => (
          <option key={item.id} value={item.name}>
            {item.name}
          </option>
        ))}
      </SelectField>

      {/* Price */}
      <div>
        <p className="mb-2 text-xs font-semibold text-[#212121]">Price</p>

        <div className="grid grid-cols-2 gap-2">
          <PriceInput
            value={minPrice}
            onChange={setMinPrice}
            placeholder="Min"
            label="Minimum price"
          />

          <PriceInput
            value={maxPrice}
            onChange={setMaxPrice}
            placeholder="Max"
            label="Maximum price"
          />
        </div>
      </div>

      {/* Availability */}
      <div>
        <p className="mb-2 text-xs font-semibold text-[#212121]">Availability</p>

        <div className="space-y-1">
          {AVAILABILITY_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={availability === value}
              onClick={() => setAvailability(value)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                availability === value
                  ? "bg-[#EAF2FF] font-medium text-[#2874F0]"
                  : "text-[#555] hover:bg-[#F5F5F5]"
              }`}
            >
              <span>{label}</span>

              {availability === value && <Check size={15} />}
            </button>
          ))}
        </div>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-[#E0E0E0] bg-white py-2.5 text-sm font-medium text-[#555] transition hover:border-[#2874F0] hover:text-[#2874F0]"
        >
          <X size={14} />
          Clear all filters
        </button>
      )}
    </div>
  );

  const hasActiveChips =
    Boolean(selectedCategoryName) ||
    brand !== "all" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    availability !== "all";

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
            <h1 className="text-2xl font-semibold text-[#212121] sm:text-3xl">Shop</h1>

            <p className="text-sm text-[#878787]">
              Explore products from brands you know and discover something new.
            </p>
          </div>
        </section>

        {/* Shop by brand */}
        {!loading && brands.length > 0 && (
          <section className="mb-5 overflow-hidden rounded-lg bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between border-b border-[#EEEEEE] px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-[#212121]">Shop by Brand</h2>

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
                aria-pressed={brand === "all"}
                onClick={() => setBrand("all")}
                className={`flex min-w-[118px] shrink-0 flex-col items-center justify-center rounded-lg border px-4 py-3 transition ${
                  brand === "all"
                    ? "border-[#2874F0] bg-[#EAF2FF]"
                    : "border-[#E0E0E0] bg-white hover:border-[#2874F0]"
                }`}
              >
                <div
                  className={`flex h-12 w-16 items-center justify-center rounded-md text-sm font-bold ${
                    brand === "all" ? "bg-[#2874F0] text-white" : "bg-[#F1F3F6] text-[#555]"
                  }`}
                >
                  All
                </div>

                <span
                  className={`mt-2 text-xs font-medium ${
                    brand === "all" ? "text-[#2874F0]" : "text-[#212121]"
                  }`}
                >
                  All Brands
                </span>
              </button>

              {/* Real brands */}
              {brands.map((item) => {
                const selected = brand === item.name;

                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setBrand(item.name)}
                    className={`flex min-w-[118px] shrink-0 flex-col items-center justify-center rounded-lg border px-4 py-3 transition ${
                      selected
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
                            selected ? "bg-[#2874F0] text-white" : "bg-[#F1F3F6] text-[#2874F0]"
                          }`}
                        >
                          {item.name?.trim()?.charAt(0)?.toUpperCase() || "B"}
                        </span>
                      )}
                    </div>

                    <span
                      className={`mt-2 max-w-[100px] truncate text-xs font-medium ${
                        selected ? "text-[#2874F0]" : "text-[#212121]"
                      }`}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Search + controls */}
        <section className="mb-5 rounded-lg bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row">
            {/* Search */}
            <div className="relative min-w-0 flex-1" role="search">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#878787]"
              />

              <input
                type="search"
                aria-label="Search products"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search for products, brands and more"
                className="h-11 w-full rounded-md border border-[#E0E0E0] bg-white pl-10 pr-10 text-sm text-[#212121] outline-none transition focus:border-[#2874F0]"
              />

              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
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
              <label className="relative flex h-11 items-center gap-2 rounded-md border border-[#E0E0E0] bg-white px-3 text-sm">
                <span className="text-[#878787]">Sort:</span>

                <select
                  aria-label="Sort products"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="w-full cursor-pointer appearance-none bg-transparent pr-7 font-medium text-[#212121] outline-none"
                >
                  <option value="default">Recommended</option>
                  <option value="low">Price: Low to High</option>
                  <option value="high">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                  <option value="new">Newest</option>
                </select>

                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 text-[#878787]"
                />
              </label>
            </div>
          </div>

          {/* Active filters */}
          {hasActiveChips && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {selectedCategoryName && (
                <FilterChip
                  label={selectedCategoryName}
                  removeLabel="Remove category filter"
                  onRemove={() => setCategory("all")}
                />
              )}

              {brand !== "all" && (
                <FilterChip
                  label={brand}
                  removeLabel="Remove brand filter"
                  onRemove={() => setBrand("all")}
                />
              )}

              {(minPrice !== "" || maxPrice !== "") && (
                <FilterChip
                  label={`₹${minPrice || "0"} – ₹${maxPrice || "∞"}`}
                  removeLabel="Remove price filter"
                  onRemove={() => {
                    setMinPrice("");
                    setMaxPrice("");
                  }}
                />
              )}

              {availability !== "all" && (
                <FilterChip
                  label={availability === "in" ? "In stock" : "Out of stock"}
                  removeLabel="Remove availability filter"
                  onRemove={() => setAvailability("all")}
                />
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
            <h2 className="text-lg font-semibold text-[#212121]">{resultsTitle}</h2>

            <p className="mt-0.5 text-xs text-[#878787]" aria-live="polite">
              {loading ? "Loading products..." : productCountLabel}
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
                  <p className="text-sm font-semibold text-[#212121]">Filters</p>

                  <p className="mt-0.5 text-xs text-[#878787]">Refine your products</p>
                </div>

                <Filter size={17} className="text-[#2874F0]" />
              </div>
            </div>

            <div className="p-4">{renderFilters()}</div>
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
              <>
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {visibleProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      imageUrl={images[product.id]}
                    />
                  ))}
                </div>

                {filtered.length > visibleProducts.length && (
                  <div className="mt-6 flex flex-col items-center gap-2">
                    <p className="text-xs text-[#878787]">
                      Showing {visibleProducts.length} of {filtered.length}
                    </p>

                    <button
                      type="button"
                      onClick={showMore}
                      className="cursor-pointer rounded-md border border-[#2874F0] bg-white px-6 py-2.5 text-sm font-semibold text-[#2874F0] transition hover:bg-[#EAF2FF]"
                    >
                      Show more products
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg bg-white px-6 py-20 text-center">
                <Search size={28} className="mx-auto text-[#2874F0]" />

                <h2 className="mt-4 text-lg font-semibold text-[#212121]">
                  No products found
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#878787]">
                  Try changing your search or removing one of the filters.
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
                <p className="text-xs font-medium text-[#2874F0]">Refine products</p>

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

            <div className="flex-1 overflow-y-auto p-5">{renderFilters()}</div>

            <div className="border-t border-[#E0E0E0] bg-white p-4">
              <button
                type="button"
                className="w-full rounded-md bg-[#2874F0] py-3 text-sm font-semibold text-white transition hover:bg-[#1F65D6]"
                onClick={() => setShowFilters(false)}
              >
                Show {productCountLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default Shop;