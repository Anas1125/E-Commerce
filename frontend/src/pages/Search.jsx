import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  Search as SearchIcon,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import { EmptyState, LoadingState } from "../components/Storefront";
import { SiteBrandingContext } from "../context/site-branding-context";
import api from "../services/api";
import { smartSearch } from "../utils/search";

const MAX_RESULTS = 25;
const SEARCH_DEBOUNCE_MS = 300;
const IMAGE_REQUEST_BATCH_SIZE = 6;

function getInlineImageUrl(product) {
  return (
    product.primary_image_url ??
    product.primary_image?.image_url ??
    product.image_url ??
    null
  );
}

function Search() {
  const { siteName = "TerraLens" } = useContext(SiteBrandingContext);

  const [params, setParams] = useSearchParams();

  const query = params.get("q") || "";
  const trimmedQuery = query.trim();

  const [inputValue, setInputValue] = useState(query);
  const [syncedQuery, setSyncedQuery] = useState(query);

  const [sort, setSort] = useState("relevance");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestedImagesRef = useRef(new Set());

  useEffect(() => {
    let alive = true;

    async function load() {
      const [productResult, categoryResult] = await Promise.allSettled([
        api.get("/products/"),
        api.get("/categories/"),
      ]);

      if (!alive) return;

      if (productResult.status === "rejected") {
        setError("Couldn't load search results.");
        setLoading(false);
        return;
      }

      const productData = productResult.value.data || [];
      const categoryData =
        categoryResult.status === "fulfilled" ? categoryResult.value.data || [] : [];

      const inlineImages = {};

      productData.forEach((product) => {
        const url = getInlineImageUrl(product);

        if (url) {
          inlineImages[product.id] = url;
          requestedImagesRef.current.add(Number(product.id));
        }
      });

      setProducts(productData);
      setCategories(categoryData);
      setImages(inlineImages);
      setLoading(false);
    }

    load().catch(() => {
      if (!alive) return;

      setError("Couldn't load search results.");
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);


  const updateQuery = (value) => {
    const next = value.trim();

    if (next) {
      setParams({ q: next }, { replace: true });
    } else {
      setParams({}, { replace: true });
    }
  };

  if (query !== syncedQuery) {
    setSyncedQuery(query);

    if (inputValue.trim() !== trimmedQuery) {
      setInputValue(query);
    }
  }

  useEffect(() => {
    if (inputValue.trim() === trimmedQuery) return undefined;

    const timer = window.setTimeout(() => {
      updateQuery(inputValue);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, trimmedQuery]);

  const submit = (event) => {
    event.preventDefault();
    updateQuery(inputValue);
  };

  const clearSearch = () => {
    setInputValue("");
    setParams({}, { replace: true });
  };


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

  const matches = useMemo(() => {
    if (!trimmedQuery) return [];

    return smartSearch(
      products,
      trimmedQuery,
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

          // Existing category fields
          product.category?.name,
          product.category?.slug,
          product.category_name,
        ];
      },
      MAX_RESULTS,
    );
  }, [products, categoryMap, trimmedQuery]);

  const results = useMemo(() => {
    const price = (product) => Number(product.price || 0);

    if (sort === "price-low") {
      return [...matches].sort((a, b) => price(a) - price(b));
    }

    if (sort === "price-high") {
      return [...matches].sort((a, b) => price(b) - price(a));
    }

    if (sort === "name") {
      return [...matches].sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || "")),
      );
    }

    return matches;
  }, [matches, sort]);

  useEffect(() => {
    const missing = matches
      .map((product) => Number(product.id))
      .filter(
        (id) => Number.isFinite(id) && !requestedImagesRef.current.has(id),
      );

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
          // Allow these to be requested again if the effect was cancelled.
          batch.forEach((id) => requestedImagesRef.current.delete(id));
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
  }, [matches]);

  return (
    <main className="min-h-screen bg-[#F1F3F6]">
      <SEO
        title="Search"
        description={`Search products by name, brand, category, or description on ${siteName}.`}
        noIndex
      />

      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="rounded-lg bg-white px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#2874F0]">
              {siteName} search
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-[#212121] sm:text-4xl">
              Search products
            </h1>

            <p className="text-sm leading-6 text-[#878787]">
              Find products by name, brand, category, or description.
            </p>
          </div>

          {/* Search bar */}
          <form onSubmit={submit} role="search" className="mt-6 flex max-w-4xl gap-2">
            <div className="relative flex-1">
              <SearchIcon
                size={19}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#878787]"
              />

              <input
                type="search"
                aria-label="Search products"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Search products, brands and more"
                className="h-12 w-full rounded-md border border-[#D8DDE3] bg-[#FAFAFA] pl-11 pr-11 text-sm text-[#212121] outline-none transition focus:border-[#2874F0] focus:bg-white focus:ring-1 focus:ring-[#2874F0]/20"
              />

              {inputValue && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#878787] hover:bg-[#EDEFF2] hover:text-[#212121] focus:outline-none focus:ring-2 focus:ring-[#2874F0]/30"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="mt-5">
          {loading ? (
            <div className="rounded-lg bg-white px-6 py-12">
              <LoadingState label="Searching products..." />
            </div>
          ) : error ? (
            <div className="rounded-lg bg-white px-6 py-12">
              <EmptyState title="Search unavailable" text={error} />
            </div>
          ) : !trimmedQuery ? (
            /* No query */
            <div className="rounded-lg bg-white px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2874F0]">
                <SearchIcon size={24} />
              </div>

              <h2 className="mt-5 text-xl font-bold text-[#212121]">
                What are you looking for?
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#878787]">
                Search for a product, brand, category, or anything you're
                interested in.
              </p>

              <Link
                to="/shop"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#2874F0] px-5 py-3 text-sm font-semibold !text-white transition hover:bg-[#1F65D6]"
              >
                Browse the shop
                <ArrowRight size={15} />
              </Link>
            </div>
          ) : results.length ? (
            <>
              <div className="rounded-lg bg-white px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#212121]">
                      Search results
                    </h2>

                    <p
                      className="mt-1 text-sm text-[#878787]"
                      aria-live="polite"
                    >
                      <span className="font-semibold text-[#212121]">
                        {results.length}
                      </span>{" "}
                      {results.length === 1 ? "product" : "products"} found for{" "}
                      <span className="font-semibold text-[#212121]">
                        “{trimmedQuery}”
                      </span>
                      {results.length >= MAX_RESULTS &&
                        " (showing the closest matches)"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={16} className="text-[#878787]" />

                    <label
                      htmlFor="search-sort"
                      className="hidden text-xs text-[#878787] sm:block"
                    >
                      Sort by
                    </label>

                    <select
                      id="search-sort"
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                      className="h-10 rounded-md border border-[#E0E0E0] bg-white px-3 text-sm font-medium text-[#212121] outline-none focus:border-[#2874F0]"
                    >
                      <option value="relevance">Relevance</option>
                      <option value="name">Name A–Z</option>
                      <option value="price-low">Price: Low to High</option>
                      <option value="price-high">Price: High to Low</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Product grid */}
              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {results.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    imageUrl={images[product.id]}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-lg bg-white px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2874F0]">
                <SearchIcon size={24} />
              </div>

              <h2 className="mt-5 text-xl font-bold text-[#212121]">
                No products found
              </h2>

              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#878787]">
                We couldn't find anything matching{" "}
                <span className="font-semibold text-[#212121]">
                  “{trimmedQuery}”
                </span>
                . Try another product name, brand, or category.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={clearSearch}
                  className="rounded-md border border-[#D8DDE3] bg-white px-5 py-2.5 text-sm font-semibold text-[#212121] hover:bg-[#F5F5F5]"
                >
                  Clear search
                </button>

                <Link
                  to="/shop"
                  className="rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-semibold !text-white transition hover:bg-[#1F65D6]"
                >
                  Browse all products
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default Search;