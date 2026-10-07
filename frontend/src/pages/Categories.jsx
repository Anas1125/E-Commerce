import { useEffect, useMemo, useState, useContext } from "react";

import {
  ArrowRight,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import {
  Link,
  useParams,
} from "react-router-dom";

import api from "../services/api";
import ProductCard from "../components/ProductCard";
import SEO from "../components/SEO";
import { SiteBrandingContext } from "../context/site-branding-context";

import {
  EmptyState,
  LoadingState,
} from "../components/Storefront";


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
    .filter(
      (word) =>
        word &&
        !STOP_WORDS.has(word),
    );
}

function editDistance(a, b) {
  const first = normalizeText(a);
  const second = normalizeText(b);

  if (!first) return second.length;
  if (!second) return first.length;

  const previous = Array.from(
    {
      length: second.length + 1,
    },
    (_, index) => index,
  );

  for (
    let i = 1;
    i <= first.length;
    i += 1
  ) {
    const current = [i];

    for (
      let j = 1;
      j <= second.length;
      j += 1
    ) {
      const insert =
        current[j - 1] + 1;

      const remove =
        previous[j] + 1;

      const replace =
        previous[j - 1] +
        (first[i - 1] ===
        second[j - 1]
          ? 0
          : 1);

      current.push(
        Math.min(
          insert,
          remove,
          replace,
        ),
      );
    }

    for (
      let j = 0;
      j < current.length;
      j += 1
    ) {
      previous[j] = current[j];
    }
  }

  return previous[
    second.length
  ];
}

function wordScore(
  queryWord,
  candidateWord,
) {
  if (
    !queryWord ||
    !candidateWord
  ) {
    return 0;
  }

  if (
    queryWord === candidateWord
  ) {
    return 100;
  }

  if (
    candidateWord.includes(
      queryWord,
    ) ||
    queryWord.includes(
      candidateWord,
    )
  ) {
    return 80;
  }

  const distance =
    editDistance(
      queryWord,
      candidateWord,
    );

  const maxLength =
    Math.max(
      queryWord.length,
      candidateWord.length,
    );

  if (
    maxLength >= 5 &&
    distance <= 1
  ) {
    return 65;
  }

  if (
    maxLength >= 7 &&
    distance <= 2
  ) {
    return 45;
  }

  return 0;
}

function getSearchScore(
  query,
  fields = [],
) {
  const normalizedQuery =
    normalizeText(query);

  if (!normalizedQuery) {
    return 1;
  }

  const searchableFields =
    fields
      .filter(Boolean)
      .map(normalizeText)
      .filter(Boolean);

  if (
    !searchableFields.length
  ) {
    return 0;
  }

  const searchableText =
    searchableFields.join(" ");

  let score = 0;

  if (
    searchableText.includes(
      normalizedQuery,
    )
  ) {
    score += 100;
  }

  const queryWords =
    tokenize(normalizedQuery);

  const candidateWords =
    tokenize(searchableText);

  let matchedWords = 0;

  for (
    const queryWord of queryWords
  ) {
    let bestScore = 0;

    for (
      const candidateWord of candidateWords
    ) {
      bestScore = Math.max(
        bestScore,
        wordScore(
          queryWord,
          candidateWord,
        ),
      );
    }

    if (bestScore > 0) {
      matchedWords += 1;
      score += bestScore;
    }
  }

  if (matchedWords > 1) {
    score +=
      matchedWords * 20;
  }

  return score;
}


function CategoryImage({
  category,
  className = "",
}) {
  if (category?.image_url) {
    return (
      <img
        src={category.image_url}
        alt={category.name}
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


function CategoryCard({
  category,
  count,
}) {
  return (
    <Link
      to={`/categories/${category.slug}`}
      className="group block overflow-hidden rounded-lg border border-[#E0E0E0] bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C5D6EA] hover:shadow-md"
    >
      <div className="relative aspect-[1.35] overflow-hidden bg-[#F1F3F6]">
        <CategoryImage
          category={category}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-white">
                {category.name}
              </h3>

              <p className="mt-1 text-xs text-white/80">
                {count}{" "}
                {count === 1
                  ? "product"
                  : "products"}
              </p>
            </div>

            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#2874F0] shadow-sm transition-transform duration-200 group-hover:translate-x-1">
              <ArrowRight size={15} />
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-xs font-bold text-[#2874F0]">
          View products
        </span>

        <ChevronRight
          size={15}
          className="text-[#878787] transition-transform group-hover:translate-x-1 group-hover:text-[#2874F0]"
        />
      </div>
    </Link>
  );
}

export function CategoryPage() {
  const { slug } = useParams();

   const { siteName = "TerraLens" } = useContext(
      SiteBrandingContext,
    );

  const [data, setData] =
    useState({
      products: [],
      category: null,
      images: {},
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [sort, setSort] =
    useState("default");

  const [stockFilter, setStockFilter] =
    useState("all");

  useEffect(() => {
    let alive = true;

    const loadCategory =
      async () => {
        try {
          const [
            categoryResponse,
            productResponse,
          ] = await Promise.all([
            api.get("/categories/"),
            api.get("/products/"),
          ]);

          const category =
            categoryResponse.data.find(
              (item) =>
                item.slug === slug,
            );

          if (!category) {
            throw new Error(
              "Category not found",
            );
          }

          const products =
            productResponse.data.filter(
              (product) =>
                product.category_id ===
                category.id,
            );

          const imageResults =
            await Promise.all(
              products.map(
                async (product) => {
                  try {
                    const response =
                      await api.get(
                        `/products/${product.id}/images`,
                      );

                    const image =
                      response.data.find(
                        (item) =>
                          item.is_primary,
                      ) ||
                      response.data[0];

                    return [
                      product.id,
                      image?.image_url ||
                        null,
                    ];
                  } catch {
                    return [
                      product.id,
                      null,
                    ];
                  }
                },
              ),
            );

          if (!alive) return;

          setData({
            category,
            products,
            images:
              Object.fromEntries(
                imageResults.filter(
                  ([, url]) => url,
                ),
              ),
          });

          setError("");
        } catch (requestError) {
          if (!alive) return;

          setError(
            requestError.message ===
              "Category not found"
              ? "This collection could not be found."
              : "We couldn't load this collection.",
          );
        } finally {
          if (alive) {
            setLoading(false);
          }
        }
      };

    loadCategory();

    return () => {
      alive = false;
    };
  }, [slug]);

  const filteredProducts =
    useMemo(() => {
      const query =
        search.trim();

      let result =
        data.products;

      if (query) {
        result = data.products
          .map((product) => ({
            product,
            score: getSearchScore(
              query,
              [
                product.name,
                product.brand,
                product.description,
                product.category?.name,
                product.category?.slug,
                product.category_name,
              ],
            ),
          }))
          .filter(
            ({ score }) =>
              score >= 25,
          )
          .sort(
            (a, b) =>
              b.score -
              a.score,
          )
          .map(
            ({ product }) =>
              product,
          );
      }

      if (
        stockFilter ===
        "in-stock"
      ) {
        result =
          result.filter(
            (product) =>
              Number(
                product.available_stock ??
                  product.stock ??
                  product.quantity ??
                  0,
              ) > 0,
          );
      }

      if (
        stockFilter ===
        "out-of-stock"
      ) {
        result =
          result.filter(
            (product) =>
              Number(
                product.available_stock ??
                  product.stock ??
                  product.quantity ??
                  0,
              ) <= 0,
          );
      }

      result = [...result];

      if (
        sort === "price-low"
      ) {
        result.sort(
          (a, b) =>
            Number(
              a.price || 0,
            ) -
            Number(
              b.price || 0,
            ),
        );
      }

      if (
        sort === "price-high"
      ) {
        result.sort(
          (a, b) =>
            Number(
              b.price || 0,
            ) -
            Number(
              a.price || 0,
            ),
        );
      }

      if (sort === "name") {
        result.sort(
          (a, b) =>
            String(
              a.name || "",
            ).localeCompare(
              String(
                b.name || "",
              ),
            ),
        );
      }

      return result;
    }, [
      data.products,
      search,
      sort,
      stockFilter,
    ]);

  const clearFilters = () => {
    setSearch("");
    setSort("default");
    setStockFilter("all");
  };

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
        title={data.category?.name || "Category"}
        description={
          data.category?.description ||
          `Browse ${
            data.category?.name || "products"
          } at ${siteName}.`
        }
        image={data.category?.image_url || ""}
      />
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* BREADCRUMB */}
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-[#878787]">
          <Link
            to="/"
            className="cursor-pointer hover:text-[#2874F0]"
          >
            Home
          </Link>

          <ChevronRight size={13} />

          <Link
            to="/categories"
            className="cursor-pointer hover:text-[#2874F0]"
          >
            Categories
          </Link>

          <ChevronRight size={13} />

          <span className="font-medium text-[#212121]">
            {data.category?.name}
          </span>
        </div>

        {/* HERO */}
        <section className="mb-7 overflow-hidden rounded-lg bg-white">
          <div className="relative h-[250px] sm:h-[300px]">
            {data.category?.image_url ? (
              <img
                src={
                  data.category
                    .image_url
                }
                alt={
                  data.category.name
                }
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

              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                {data.category.name}
              </h1>

              <p className="mt-2 text-sm text-white/80">
                {data.products.length}{" "}
                {data.products.length ===
                1
                  ? "product"
                  : "products"}{" "}
                available
              </p>
            </div>
          </div>
        </section>

        {/* PRODUCTS */}
        <section>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#2874F0]">
                Collection
              </p>

              <h2 className="mt-1 text-2xl font-bold text-[#212121]">
                {filteredProducts.length}{" "}
                {filteredProducts.length ===
                1
                  ? "product"
                  : "products"}
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

          {/* TOOLBAR */}
          <div className="mb-6 border border-[#E0E0E0] bg-white p-3">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#878787]"
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder={`Search ${String(
                    data.category.name,
                  ).toLowerCase()}...`}
                  className="h-11 w-full rounded-md border border-[#D0D0D0] bg-white pl-11 pr-10 text-sm outline-none focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]/20"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch("")
                    }
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#878787] hover:bg-[#F1F3F6]"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={
                    stockFilter
                  }
                  onChange={(event) =>
                    setStockFilter(
                      event.target
                        .value,
                    )
                  }
                  className="h-11 cursor-pointer rounded-md border border-[#E0E0E0] bg-white px-3 text-sm font-medium outline-none focus:border-[#2874F0]"
                >
                  <option value="all">
                    All stock
                  </option>

                  <option value="in-stock">
                    In stock
                  </option>

                  <option value="out-of-stock">
                    Out of stock
                  </option>
                </select>

                <select
                  value={sort}
                  onChange={(event) =>
                    setSort(
                      event.target
                        .value,
                    )
                  }
                  className="h-11 cursor-pointer rounded-md border border-[#E0E0E0] bg-white px-3 text-sm font-medium outline-none focus:border-[#2874F0]"
                >
                  <option value="default">
                    Featured
                  </option>

                  <option value="name">
                    Name A-Z
                  </option>

                  <option value="price-low">
                    Price: Low to High
                  </option>

                  <option value="price-high">
                    Price: High to Low
                  </option>
                </select>

                {(search ||
                  sort !==
                    "default" ||
                  stockFilter !==
                    "all") && (
                  <button
                    type="button"
                    onClick={
                      clearFilters
                    }
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
                Smart search checks product names,
                brands, descriptions and category
                information, including common typing
                mistakes.
              </p>
            )}
          </div>

          {filteredProducts.length ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {filteredProducts.map(
                (product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    imageUrl={
                      data.images[
                        product.id
                      ]
                    }
                  />
                ),
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-[#E0E0E0] bg-white px-6 py-14 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
                <Search size={22} />
              </div>

              <h3 className="mt-4 font-bold text-[#212121]">
                No products found
              </h3>

              <p className="mt-2 text-sm text-[#878787]">
                Try another search or clear your filters.
              </p>

              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="mt-5 cursor-pointer rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-bold !text-white hover:bg-[#1F65D6]"
              >
                Clear filters
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Categories() {
  const { siteName = "TerraLens" } = useContext(
    SiteBrandingContext,
  );

  const [categories, setCategories] =
    useState([]);

  const [products, setProducts] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [sort, setSort] =
    useState("name");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState(false);

  const [searchImages, setSearchImages] =
    useState({});

  useEffect(() => {
    let alive = true;

    const loadData =
      async () => {
        try {
          const [
            categoryResponse,
            productResponse,
          ] = await Promise.all([
            api.get("/categories/"),
            api.get("/products/"),
          ]);

          if (!alive) return;

          setCategories(
            categoryResponse.data ||
              [],
          );

          setProducts(
            productResponse.data ||
              [],
          );
        } catch {
          if (alive) {
            setError(true);
          }
        } finally {
          if (alive) {
            setLoading(false);
          }
        }
      };

    loadData();

    return () => {
      alive = false;
    };
  }, []);

  const categoryCounts =
    useMemo(() => {
      return products.reduce(
        (counts, product) => {
          if (
            product.category_id
          ) {
            counts[
              product.category_id
            ] =
              (counts[
                product.category_id
              ] || 0) + 1;
          }

          return counts;
        },
        {},
      );
    }, [products]);

  const searchResults =
    useMemo(() => {
      const query =
        search.trim();

      if (!query) {
        return [];
      }

      const results = [];

      for (
        const category of categories
      ) {
        const categoryProducts =
          products.filter(
            (product) =>
              product.category_id ===
              category.id,
          );

        const categoryScore =
          getSearchScore(
            query,
            [
              category.name,
              category.slug,
              category.description,
            ],
          );

        const matchingProducts =
          categoryProducts
            .map((product) => ({
              product,
              score:
                getSearchScore(
                  query,
                  [
                    product.name,
                    product.brand,
                    product.description,
                    product.category
                      ?.name,
                    product.category
                      ?.slug,
                    product.category_name,
                  ],
                ),
            }))
            .filter(
              ({ score }) =>
                score >= 25,
            )
            .sort(
              (a, b) =>
                b.score -
                a.score,
            )
            .map(
              ({ product }) =>
                product,
            );

        if (
          categoryScore >= 20 ||
          matchingProducts.length
        ) {
          results.push({
            category,
            categoryScore,
            matchingProducts,
            allProducts:
              categoryProducts,
          });
        }
      }

      results.sort((a, b) => {
        const aProductBoost =
          a.matchingProducts.length
            ? 1000
            : 0;

        const bProductBoost =
          b.matchingProducts.length
            ? 1000
            : 0;

        return (
          bProductBoost +
          b.categoryScore -
          (aProductBoost +
            a.categoryScore)
        );
      });

      return results;
    }, [
      categories,
      products,
      search,
    ]);

  useEffect(() => {
    let alive = true;

    const matchingProducts =
      searchResults.flatMap(
        (result) =>
          result.matchingProducts
            .slice(0, 4),
      );

    const uniqueProducts =
      Array.from(
        new Map(
          matchingProducts.map(
            (product) => [
              product.id,
              product,
            ],
          ),
        ).values(),
      );

    if (
      !search.trim() ||
      !uniqueProducts.length
    ) {
      return () => {
        alive = false;
      };
    }

    const loadImages =
      async () => {
        const entries =
          await Promise.all(
            uniqueProducts.map(
              async (product) => {
                if (
                  product.image_url ||
                  product.primary_image_url
                ) {
                  return [
                    product.id,
                    product.image_url ||
                      product.primary_image_url,
                  ];
                }

                try {
                  const response =
                    await api.get(
                      `/products/${product.id}/images`,
                    );

                  const image =
                    response.data.find(
                      (item) =>
                        item.is_primary,
                    ) ||
                    response.data[0];

                  return [
                    product.id,
                    image?.image_url ||
                      null,
                  ];
                } catch {
                  return [
                    product.id,
                    null,
                  ];
                }
              },
            ),
          );

        if (!alive) return;

        setSearchImages(
          (current) => ({
            ...current,
            ...Object.fromEntries(
              entries.filter(
                ([, url]) => url,
              ),
            ),
          }),
        );
      };

    loadImages();

    return () => {
      alive = false;
    };
  }, [searchResults, search]);

  const featuredCategories =
    useMemo(() => {
      return [...categories]
        .sort(
          (a, b) =>
            (categoryCounts[
              b.id
            ] || 0) -
            (categoryCounts[
              a.id
            ] || 0),
        )
        .slice(0, 4);
    }, [
      categories,
      categoryCounts,
    ]);

  const sortedCategories =
    useMemo(() => {
      const result = [
        ...categories,
      ];

      if (
        sort === "products"
      ) {
        result.sort(
          (a, b) =>
            (categoryCounts[
              b.id
            ] || 0) -
            (categoryCounts[
              a.id
            ] || 0),
        );
      } else {
        result.sort((a, b) =>
          String(
            a.name || "",
          ).localeCompare(
            String(
              b.name || "",
            ),
          ),
        );
      }

      return result;
    }, [
      categories,
      categoryCounts,
      sort,
    ]);

  const isSearching =
    search.trim().length > 0;

  const clearSearch = () => {
    setSearch("");
    setSearchImages({});
  };


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
                Explore TerraLens
              </p>

              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#212121] sm:text-4xl">
                Shop by category
              </h1>

              <p className="mt-3 text-sm leading-6 text-[#878787] sm:text-base">
                Search naturally or browse our collections.
                You don't need to know the exact category name.
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

          {!loading &&
            !error && (
              <div className="relative mt-7 max-w-4xl">
                <Search
                  size={19}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#878787]"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Search products or categories..."
                  autoComplete="off"
                  className="h-12 w-full rounded-md border border-[#D0D0D0] bg-white pl-11 pr-12 text-sm text-[#212121] outline-none transition placeholder:text-[#999999] focus:border-[#2874F0] focus:ring-1 focus:ring-[#2874F0]/20"
                />

                {search && (
                  <button
                    type="button"
                    onClick={
                      clearSearch
                    }
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

              <h2 className="mt-1 text-2xl font-bold text-[#212121]">
                Search results
              </h2>

              <p className="mt-1 text-sm text-[#878787]">
                Results based on your actual catalog.
              </p>
            </div>

            <button
              type="button"
              onClick={
                clearSearch
              }
              className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md border border-[#E0E0E0] bg-white px-4 py-2 text-sm font-bold text-[#212121] hover:border-[#2874F0] hover:text-[#2874F0]"
            >
              <X size={14} />
              Clear search
            </button>
          </div>

          {searchResults.length ? (
            <div className="space-y-6">
              {searchResults.map(
                (result) => (
                  <section
                    key={
                      result.category
                        .id
                    }
                    className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white"
                  >
                    <div className="flex flex-col gap-3 border-b border-[#E0E0E0] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-[#F1F3F6]">
                          <CategoryImage
                            category={
                              result.category
                            }
                          />
                        </div>

                        <div className="min-w-0">
                          <Link
                            to={`/categories/${result.category.slug}`}
                            className="cursor-pointer text-lg font-bold text-[#212121] hover:text-[#2874F0]"
                          >
                            {
                              result.category
                                .name
                            }
                          </Link>

                          <p className="mt-1 text-sm text-[#878787]">
                            {
                              result.allProducts
                                .length
                            }{" "}
                            {result.allProducts
                              .length ===
                            1
                              ? "product"
                              : "products"}
                          </p>
                        </div>
                      </div>

                      <Link
                        to={`/categories/${result.category.slug}`}
                        className="inline-flex w-fit cursor-pointer items-center gap-1 text-sm font-bold text-[#2874F0] hover:text-[#1F65D6]"
                      >
                        View category
                        <ChevronRight
                          size={15}
                        />
                      </Link>
                    </div>

                    {result.matchingProducts
                      .length ? (
                      <div className="p-4 sm:p-5">
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                          {result.matchingProducts
                            .slice(0, 4)
                            .map(
                              (
                                product,
                              ) => (
                                <ProductCard
                                  key={
                                    product.id
                                  }
                                  product={
                                    product
                                  }
                                  imageUrl={
                                    searchImages[
                                      product.id
                                    ] ||
                                    product.image_url ||
                                    product.primary_image_url
                                  }
                                />
                              ),
                            )}
                        </div>

                        {result.matchingProducts
                          .length > 4 && (
                          <div className="mt-5 flex justify-center">
                            <Link
                              to={`/categories/${result.category.slug}`}
                              className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#E0E0E0] bg-white px-5 py-2.5 text-sm font-bold text-[#2874F0] hover:border-[#2874F0]"
                            >
                              View all matching products
                              <ArrowRight
                                size={15}
                              />
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
                ),
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-[#E0E0E0] bg-white px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F0FE] text-[#2874F0]">
                <Search size={22} />
              </div>

              <h3 className="mt-4 font-bold text-[#212121]">
                No matching categories or products
              </h3>

              <p className="mt-2 text-sm text-[#878787]">
                Try a different spelling or a broader search.
              </p>

              <button
                type="button"
                onClick={
                  clearSearch
                }
                className="mt-5 cursor-pointer rounded-md bg-[#2874F0] px-5 py-2.5 text-sm font-bold !text-white hover:bg-[#1F65D6]"
              >
                Clear search
              </button>
            </div>
          )}
        </section>
      ) : (
        <>

          {featuredCategories.length >
            0 && (
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
                {featuredCategories.map(
                  (category) => (
                    <CategoryCard
                      key={
                        category.id
                      }
                      category={
                        category
                      }
                      count={
                        categoryCounts[
                          category.id
                        ] || 0
                      }
                    />
                  ),
                )}
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
                    Browse the complete TerraLens collection.
                  </p>
                </div>

                <div className="text-sm text-[#878787]">
                  <span className="font-bold text-[#212121]">
                    {
                      categories.length
                    }
                  </span>{" "}
                  {categories.length ===
                  1
                    ? "category"
                    : "categories"}
                </div>
              </div>

              {/* SORT */}
              <div className="flex items-center justify-end border-b border-[#E0E0E0] bg-[#FAFAFA] px-5 py-3 sm:px-6">
                <div className="flex items-center gap-2 text-sm text-[#878787]">
                  <SlidersHorizontal
                    size={15}
                  />

                  <select
                    value={sort}
                    onChange={(event) =>
                      setSort(
                        event.target
                          .value,
                      )
                    }
                    className="h-9 cursor-pointer rounded-md border border-[#E0E0E0] bg-white px-3 text-sm font-medium text-[#212121] outline-none focus:border-[#2874F0]"
                  >
                    <option value="name">
                      Name A-Z
                    </option>

                    <option value="products">
                      Most products
                    </option>
                  </select>
                </div>
              </div>

              {/* CATEGORY GRID */}
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {sortedCategories.map(
                    (category) => (
                      <CategoryCard
                        key={
                          category.id
                        }
                        category={
                          category
                        }
                        count={
                          categoryCounts[
                            category.id
                          ] || 0
                        }
                      />
                    ),
                  )}
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
                  Explore the complete TerraLens collection.
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