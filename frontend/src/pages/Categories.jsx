import {
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import { EmptyState, LoadingState } from "../components/Storefront";
import { SiteBrandingContext } from "../context/site-branding-context";
import api from "../services/api";

const PAGE_SIZE = 24;
const IMAGE_REQUEST_BATCH_SIZE = 6;
const PRODUCT_MATCH_THRESHOLD = 25;
const CATEGORY_MATCH_THRESHOLD = 20;
const PRODUCTS_PER_CATEGORY_RESULT = 4;

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "for",
  "with",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
]);

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value = "") {
  return normalizeText(value)
    .split(" ")
    .filter((word) => word && !STOP_WORDS.has(word));
}

function editDistance(first, second) {
  if (!first) return second.length;
  if (!second) return first.length;

  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);

  for (let i = 1; i <= first.length; i += 1) {
    const current = [i];

    for (let j = 1; j <= second.length; j += 1) {
      const insert = current[j - 1] + 1;
      const remove = previous[j] + 1;
      const replace = previous[j - 1] + (first[i - 1] === second[j - 1] ? 0 : 1);

      current.push(Math.min(insert, remove, replace));
    }

    for (let j = 0; j < current.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[second.length];
}

function wordScore(queryWord, candidateWord) {
  if (!queryWord || !candidateWord) return 0;

  if (queryWord === candidateWord) return 100;


  if (queryWord.length >= 2 && candidateWord.includes(queryWord)) return 80;
  if (candidateWord.length >= 3 && queryWord.includes(candidateWord)) return 80;

  const maxLength = Math.max(queryWord.length, candidateWord.length);

  if (maxLength < 5 || Math.abs(queryWord.length - candidateWord.length) > 2) {
    return 0;
  }

  const distance = editDistance(queryWord, candidateWord);

  if (distance <= 1) return 65;
  if (maxLength >= 7 && distance <= 2) return 45;

  return 0;
}

function makeQuery(query) {
  const normalized = normalizeText(query);

  return { normalized, words: [...new Set(tokenize(normalized))] };
}

function buildSearchEntry(fields = []) {
  const text = fields
    .filter(Boolean)
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");

  return { text, words: [...new Set(tokenize(text))] };
}

function scoreEntry(query, entry) {
  if (!query.normalized) return 1;
  if (!entry?.text) return 0;

  let score = 0;

  if (entry.text.includes(query.normalized)) {
    score += 100;
  }

  let matchedWords = 0;

  for (const queryWord of query.words) {
    let best = 0;

    for (const candidateWord of entry.words) {
      const current = wordScore(queryWord, candidateWord);

      if (current > best) {
        best = current;
        if (best === 100) break;
      }
    }

    if (best > 0) {
      matchedWords += 1;
      score += best;
    }
  }

  if (matchedWords > 1) {
    score += matchedWords * 20;
  }

  return score;
}

function getBrandName(product) {
  if (typeof product.brand === "string") return product.brand;

  return product.brand?.name ?? product.brand_name ?? "";
}

function getProductSearchFields(product) {
  return [
    product.name,
    getBrandName(product),
    product.description,
    product.category?.name,
    product.category?.slug,
    product.category_name,
  ];
}

function rankProducts(products, query, index) {
  return products
    .map((product) => ({
      product,
      score: scoreEntry(query, index.get(product.id)),
    }))
    .filter(({ score }) => score >= PRODUCT_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map(({ product }) => product);
}

function getStock(product) {
  return Number(product.available_stock ?? product.stock ?? product.quantity ?? 0);
}

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getInlineImageUrl(product) {
  return (
    product.primary_image_url ??
    product.primary_image?.image_url ??
    product.image_url ??
    null
  );
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


function CategoryImage({ category, className = "" }) {
  if (category?.image_url) {
    return (
      <img
        src={category.image_url}
        alt=""
        className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${className}`}
      />
    );
  }

  return (
    <div
      className={`h-full w-full bg-gradient-to-br from-[#EAF2FF] via-[#F1F3F6] to-[#DCE7F8] ${className}`}
    />
  );
}

function CategoryCard({ category, count }) {
  return (
    <Link
      to={`/categories/${category.slug}`}
      className="group block overflow-hidden rounded-lg border border-[#E0E0E0] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C5D6EA] hover:shadow-md"
    >
      <div className="relative aspect-[1.35] overflow-hidden bg-[#F1F3F6]">
        <CategoryImage category={category} />

        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-white">
                {category.name}
              </h3>

              <p className="mt-1 text-xs text-white/80">
                {pluralize(count, "product", "products")}
              </p>
            </div>

            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#2874F0] shadow-sm transition-transform duration-200 group-hover:translate-x-1">
              <ArrowRight size={15} />
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-bold text-[#2874F0]">View products</span>

        <ChevronRight
          size={15}
          className="text-[#878787] transition-transform group-hover:translate-x-1 group-hover:text-[#2874F0]"
        />
      </div>
    </Link>
  );
}

function NoResults({ title, text, actionLabel, onAction }) {
  return (
    <div className="rounded-lg border border-[#E0E0E0] bg-white px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
        <Search size={22} />
      </div>

      <h3 className="mt-4 font-bold text-[#212121]">{title}</h3>

      <p className="mt-2 text-sm text-[#878787]">{text}</p>

      <button
        type="button"
        onClick={onAction}
        className="mt-5 cursor-pointer rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-bold !text-white hover:bg-[#1F65D6]"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function CategoryPageContent({ slug }) {
  const { siteName = "TerraLens" } = useContext(SiteBrandingContext);

  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [stockFilter, setStockFilter] = useState("all");

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const [categoryResponse, productResponse] = await Promise.all([
          api.get("/categories/"),
          api.get("/products/"),
        ]);

        if (!alive) return;

        const found = (categoryResponse.data || []).find((item) => item.slug === slug);

        if (!found) {
          setError("This collection could not be found.");
          setLoading(false);
          return;
        }

        setCategory(found);
        setProducts(
          (productResponse.data || []).filter(
            (product) => String(product.category_id) === String(found.id),
          ),
        );
        setLoading(false);
      } catch {
        if (!alive) return;

        setError("We couldn't load this collection.");
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [slug]);

  const searchIndex = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          buildSearchEntry(getProductSearchFields(product)),
        ]),
      ),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const query = makeQuery(deferredSearch);

    let result = query.normalized
      ? rankProducts(products, query, searchIndex)
      : [...products];

    if (stockFilter === "in-stock") {
      result = result.filter((product) => getStock(product) > 0);
    }

    if (stockFilter === "out-of-stock") {
      result = result.filter((product) => getStock(product) <= 0);
    }

    const price = (product) => Number(product.price || 0);

    if (sort === "price-low") {
      result.sort((a, b) => price(a) - price(b));
    }

    if (sort === "price-high") {
      result.sort((a, b) => price(b) - price(a));
    }

    if (sort === "name") {
      result.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }

    return result;
  }, [products, searchIndex, deferredSearch, sort, stockFilter]);


  const filterSignature = [deferredSearch.trim(), sort, stockFilter].join("|");

  const [pageState, setPageState] = useState({ signature: "", count: PAGE_SIZE });

  const visibleCount =
    pageState.signature === filterSignature ? pageState.count : PAGE_SIZE;

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount],
  );

  const images = useProductImages(visibleProducts);

  const showMore = () => {
    setPageState({ signature: filterSignature, count: visibleCount + PAGE_SIZE });
  };

  const clearFilters = () => {
    setSearch("");
    setSort("default");
    setStockFilter("all");
  };

  const hasFilters = Boolean(search) || sort !== "default" || stockFilter !== "all";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1F3F6]">
        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
          <LoadingState label="Loading collection..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#F1F3F6]">
        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState
            title="Collection unavailable"
            text={error}
            action="Browse categories"
            to="/categories"
          />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F1F3F6]">
      <SEO
        title={category.name || "Category"}
        description={
          category.description || `Browse ${category.name || "products"} at ${siteName}.`
        }
        image={category.image_url || ""}
      />

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="mb-5 flex flex-wrap items-center gap-2 text-xs text-[#878787]"
        >
          <Link to="/" className="cursor-pointer hover:text-[#2874F0]">
            Home
          </Link>

          <ChevronRight size={13} />

          <Link to="/categories" className="cursor-pointer hover:text-[#2874F0]">
            Categories
          </Link>

          <ChevronRight size={13} />

          <span className="font-medium text-[#212121]" aria-current="page">
            {category.name}
          </span>
        </nav>

        {/* Hero */}
        <section className="mb-7 overflow-hidden rounded-lg bg-white">
          <div className="relative h-[250px] sm:h-[300px]">
            {category.image_url ? (
              <img
                src={category.image_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#DCE7F8] to-[#F1F3F6]" />
            )}

            <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/35 to-transparent" />

            <div className="relative flex h-full max-w-xl flex-col justify-end px-6 pb-7 text-white sm:px-10 sm:pb-9">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/75">
                {siteName} Collection
              </p>

              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{category.name}</h1>

              <p className="mt-2 text-sm text-white/80">
                {pluralize(products.length, "product", "products")} available
              </p>
            </div>
          </div>
        </section>

        {/* Products */}
        <section>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2874F0]">
                Collection
              </p>

              <h2 className="mt-1 text-2xl font-bold text-[#212121]" aria-live="polite">
                {pluralize(filteredProducts.length, "product", "products")}
              </h2>
            </div>

            <Link
              to="/shop"
              className="inline-flex w-fit cursor-pointer items-center gap-1 text-sm font-bold text-[#2874F0] hover:text-[#1F65D6]"
            >
              View all products
              <ArrowRight size={15} />
            </Link>
          </div>

          {/* Toolbar */}
          <div className="mb-6 border border-[#E0E0E0] bg-white p-3">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1" role="search">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#878787]"
                />

                <input
                  type="search"
                  aria-label={`Search ${String(category.name).toLowerCase()}`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${String(category.name).toLowerCase()}...`}
                  className="h-11 w-full rounded-md border border-[#D0D0D0] bg-white pl-11 pr-10 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]/20"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#878787] hover:bg-[#F1F3F6]"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Filter by stock"
                  value={stockFilter}
                  onChange={(event) => setStockFilter(event.target.value)}
                  className="h-11 cursor-pointer rounded-md border border-[#E0E0E0] bg-white px-3 text-sm font-medium outline-none focus:border-[#2874F0]"
                >
                  <option value="all">All stock</option>
                  <option value="in-stock">In stock</option>
                  <option value="out-of-stock">Out of stock</option>
                </select>

                <select
                  aria-label="Sort products"
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="h-11 cursor-pointer rounded-md border border-[#E0E0E0] bg-white px-3 text-sm font-medium outline-none focus:border-[#2874F0]"
                >
                  <option value="default">Featured</option>
                  <option value="name">Name A-Z</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>

                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex h-11 cursor-pointer items-center gap-1 px-2 text-xs font-bold text-[#2874F0]"
                  >
                    <X size={13} />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {search.trim() && (
              <p className="mt-3 border-t border-[#F0F0F0] pt-3 text-xs text-[#878787]">
                Smart search checks product names, brands, descriptions and category
                information, including common typing mistakes.
              </p>
            )}
          </div>

          {filteredProducts.length ? (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {visibleProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    imageUrl={images[product.id]}
                  />
                ))}
              </div>

              {filteredProducts.length > visibleProducts.length && (
                <div className="mt-6 flex flex-col items-center gap-2">
                  <p className="text-xs text-[#878787]">
                    Showing {visibleProducts.length} of {filteredProducts.length}
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
            <NoResults
              title="No products found"
              text="Try another search or clear your filters."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          )}
        </section>
      </div>
    </main>
  );
}

export function CategoryPage() {
  const { slug } = useParams();

  return <CategoryPageContent key={slug} slug={slug} />;
}


function Categories() {
  const { siteName = "TerraLens" } = useContext(SiteBrandingContext);

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const [categoryResponse, productResponse] = await Promise.all([
          api.get("/categories/"),
          api.get("/products/"),
        ]);

        if (!alive) return;

        setCategories(categoryResponse.data || []);
        setProducts(productResponse.data || []);
        setLoading(false);
      } catch {
        if (!alive) return;

        setError(true);
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  const productsByCategory = useMemo(() => {
    const map = new Map();

    products.forEach((product) => {
      if (product.category_id == null) return;

      const key = String(product.category_id);

      if (!map.has(key)) map.set(key, []);
      map.get(key).push(product);
    });

    return map;
  }, [products]);

  const countFor = (category) => productsByCategory.get(String(category.id))?.length || 0;

  const searchIndex = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          buildSearchEntry(getProductSearchFields(product)),
        ]),
      ),
    [products],
  );

  const searchResults = useMemo(() => {
    const query = makeQuery(deferredSearch);

    if (!query.normalized) return [];

    const results = [];

    for (const category of categories) {
      const allProducts = productsByCategory.get(String(category.id)) || [];

      const categoryScore = scoreEntry(
        query,
        buildSearchEntry([category.name, category.slug, category.description]),
      );

      const matchingProducts = rankProducts(allProducts, query, searchIndex);

      if (categoryScore >= CATEGORY_MATCH_THRESHOLD || matchingProducts.length) {
        results.push({ category, categoryScore, matchingProducts, allProducts });
      }
    }

    const rank = (result) =>
      (result.matchingProducts.length ? 1000 : 0) + result.categoryScore;

    return results.sort((a, b) => rank(b) - rank(a));
  }, [categories, productsByCategory, searchIndex, deferredSearch]);

  const displayedSearchProducts = useMemo(
    () =>
      searchResults.flatMap((result) =>
        result.matchingProducts.slice(0, PRODUCTS_PER_CATEGORY_RESULT),
      ),
    [searchResults],
  );

  const searchImages = useProductImages(displayedSearchProducts);

  const featuredCategories = useMemo(
    () =>
      [...categories]
        .sort(
          (a, b) =>
            (productsByCategory.get(String(b.id))?.length || 0) -
            (productsByCategory.get(String(a.id))?.length || 0),
        )
        .slice(0, 4),
    [categories, productsByCategory],
  );

  const sortedCategories = useMemo(() => {
    const result = [...categories];

    if (sort === "products") {
      result.sort(
        (a, b) =>
          (productsByCategory.get(String(b.id))?.length || 0) -
          (productsByCategory.get(String(a.id))?.length || 0),
      );
    } else {
      result.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }

    return result;
  }, [categories, productsByCategory, sort]);

  const isSearching = search.trim().length > 0;

  const clearSearch = () => setSearch("");

  return (
    <main className="min-h-screen bg-[#F1F3F6]">
      <SEO
        title="Categories"
        description={`Browse product categories at ${siteName}. Explore products across different categories and find what you need.`}
      />

      <section className="border-b border-[#E0E0E0] bg-white">
        <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2874F0]">
                Explore {siteName}
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#212121] sm:text-4xl">
                Shop by category
              </h1>

              <p className="mt-3 text-sm leading-6 text-[#878787] sm:text-base">
                Search naturally or browse our collections. You don't need to know
                the exact category name.
              </p>
            </div>

            <Link
              to="/shop"
              className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-5 py-3 text-sm font-bold !text-white transition hover:bg-[#1F65D6]"
            >
              Shop all products
              <ArrowRight size={16} />
            </Link>
          </div>

          {!loading && !error && (
            <div className="relative mt-7 max-w-4xl" role="search">
              <Search
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#878787]"
              />

              <input
                type="search"
                aria-label="Search products or categories"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products or categories..."
                autoComplete="off"
                className="h-12 w-full rounded-md border border-[#D0D0D0] bg-white pl-11 pr-12 text-sm text-[#212121] outline-none transition placeholder:text-[#999999] focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]/20"
              />

              {search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#878787] hover:bg-[#F1F3F6] hover:text-[#212121]"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {loading ? (
        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
          <LoadingState label="Loading categories..." />
        </div>
      ) : error ? (
        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-8">
          <EmptyState
            title="Couldn't load categories"
            text="Please try again in a moment."
          />
        </div>
      ) : isSearching ? (
        <section className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2874F0]">
                Smart search
              </p>

              <h2 className="mt-1 text-2xl font-bold text-[#212121]">Search results</h2>

              <p className="mt-1 text-sm text-[#878787]">
                Results based on your actual catalog.
              </p>
            </div>

            <button
              type="button"
              onClick={clearSearch}
              className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-[#E0E0E0] bg-white px-4 py-2 text-sm font-bold text-[#212121] hover:border-[#2874F0] hover:text-[#2874F0]"
            >
              <X size={14} />
              Clear search
            </button>
          </div>

          {searchResults.length ? (
            <div className="space-y-6">
              {searchResults.map((result) => (
                <section
                  key={result.category.id}
                  className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white"
                >
                  <div className="flex flex-col gap-3 border-b border-[#E0E0E0] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-[#F1F3F6]">
                        <CategoryImage category={result.category} />
                      </div>

                      <div className="min-w-0">
                        <Link
                          to={`/categories/${result.category.slug}`}
                          className="cursor-pointer text-lg font-bold text-[#212121] hover:text-[#2874F0]"
                        >
                          {result.category.name}
                        </Link>

                        <p className="mt-1 text-sm text-[#878787]">
                          {pluralize(result.allProducts.length, "product", "products")}
                        </p>
                      </div>
                    </div>

                    <Link
                      to={`/categories/${result.category.slug}`}
                      className="inline-flex w-fit cursor-pointer items-center gap-1 text-sm font-bold text-[#2874F0] hover:text-[#1F65D6]"
                    >
                      View category
                      <ChevronRight size={15} />
                    </Link>
                  </div>

                  {result.matchingProducts.length ? (
                    <div className="p-4 sm:p-5">
                      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        {result.matchingProducts
                          .slice(0, PRODUCTS_PER_CATEGORY_RESULT)
                          .map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              imageUrl={searchImages[product.id]}
                            />
                          ))}
                      </div>

                      {result.matchingProducts.length > PRODUCTS_PER_CATEGORY_RESULT && (
                        <div className="mt-5 flex justify-center">
                          <Link
                            to={`/categories/${result.category.slug}`}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#E0E0E0] bg-white px-5 py-2.5 text-sm font-bold text-[#2874F0] hover:border-[#2874F0]"
                          >
                            View all matching products
                            <ArrowRight size={15} />
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center sm:px-6">
                      <p className="text-sm text-[#878787]">
                        This category matched your search.
                      </p>
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <NoResults
              title="No matching categories or products"
              text="Try a different spelling or a broader search."
              actionLabel="Clear search"
              onAction={clearSearch}
            />
          )}
        </section>
      ) : (
        <>
          {featuredCategories.length > 0 && (
            <section className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2874F0]">
                    Popular collections
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-[#212121]">
                    Featured categories
                  </h2>
                </div>

                <a
                  href="#all-categories"
                  className="cursor-pointer text-sm font-bold text-[#2874F0] hover:text-[#1F65D6]"
                >
                  View all
                </a>
              </div>

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {featuredCategories.map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    count={countFor(category)}
                  />
                ))}
              </div>
            </section>
          )}

          <section
            id="all-categories"
            className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8"
          >
            <div className="border border-[#E0E0E0] bg-white">
              <div className="flex flex-col gap-4 border-b border-[#E0E0E0] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
                <div>
                  <h2 className="text-xl font-bold text-[#212121] sm:text-2xl">
                    All categories
                  </h2>

                  <p className="mt-1 text-sm text-[#878787]">
                    Browse the complete {siteName} collection.
                  </p>
                </div>

                <div className="text-sm text-[#878787]">
                  <span className="font-bold text-[#212121]">{categories.length}</span>{" "}
                  {categories.length === 1 ? "category" : "categories"}
                </div>
              </div>

              {/* Sort */}
              <div className="flex items-center justify-end border-b border-[#E0E0E0] bg-[#FAFAFA] px-5 py-3 sm:px-6">
                <div className="flex items-center gap-2 text-sm text-[#878787]">
                  <SlidersHorizontal size={15} />

                  <select
                    aria-label="Sort categories"
                    value={sort}
                    onChange={(event) => setSort(event.target.value)}
                    className="h-9 cursor-pointer rounded-md border border-[#E0E0E0] bg-white px-3 text-sm font-medium text-[#212121] outline-none focus:border-[#2874F0]"
                  >
                    <option value="name">Name A-Z</option>
                    <option value="products">Most products</option>
                  </select>
                </div>
              </div>

              {/* Category grid */}
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {sortedCategories.map((category) => (
                    <CategoryCard
                      key={category.id}
                      category={category}
                      count={countFor(category)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="mx-auto max-w-[1400px] px-4 pb-8 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 rounded-lg border border-[#E0E0E0] bg-white px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div>
                <h2 className="text-base font-bold text-[#212121]">
                  Want to browse everything?
                </h2>

                <p className="mt-1 text-sm text-[#878787]">
                  Explore the complete {siteName} collection.
                </p>
              </div>

              <Link
                to="/shop"
                className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-bold !text-white transition hover:bg-[#1F65D6]"
              >
                Shop all products
                <ArrowRight size={15} />
              </Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default Categories;