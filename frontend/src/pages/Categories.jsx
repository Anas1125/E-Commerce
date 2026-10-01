import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";
import ProductCard from "../components/ProductCard";
import {
  EmptyState,
  LoadingState,
} from "../components/Storefront";

function CategoryImage({ category, className = "" }) {
  if (category.image_url) {
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
      className={`h-full w-full bg-gradient-to-br from-[#DCE7DE] via-[#E8EEE7] to-[#C8D7CC] ${className}`}
    />
  );
}

function CategoryCard({ category, count }) {
  return (
    <Link
      to={`/categories/${category.slug}`}
      className="group block overflow-hidden rounded-2xl border border-[#E3E5DF] bg-white transition-all duration-300 hover:-translate-y-1 hover:border-[#C8D5CA] hover:shadow-lg hover:shadow-black/[0.06]"
    >
      <div className="relative aspect-[1.45] overflow-hidden bg-[#E8EEE7]">
        <CategoryImage category={category} />

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />

        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {category.name}
            </h3>

            <p className="mt-0.5 text-xs text-white/75">
              {count} {count === 1 ? "product" : "products"}
            </p>
          </div>

          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#385744] shadow-sm transition-transform duration-300 group-hover:translate-x-1">
            <ArrowRight size={16} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function CategoryPage() {
  const { slug } = useParams();

  const [data, setData] = useState({
    products: [],
    category: null,
    images: {},
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [stockFilter, setStockFilter] = useState("all");

  useEffect(() => {
    let alive = true;

    const loadCategory = async () => {
      try {
        setLoading(true);
        setError("");

        const [categoryResponse, productResponse] = await Promise.all([
          api.get("/categories/"),
          api.get("/products/"),
        ]);

        const category = categoryResponse.data.find(
          (item) => item.slug === slug,
        );

        if (!category) {
          throw new Error("Category not found");
        }

        const products = productResponse.data.filter(
          (product) => product.category_id === category.id,
        );

        const imageResults = await Promise.all(
          products.map(async (product) => {
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

        setData({
          category,
          products,
          images: Object.fromEntries(
            imageResults.filter(([, url]) => url),
          ),
        });
      } catch (requestError) {
        if (!alive) return;

        setError(
          requestError.message === "Category not found"
            ? "This collection could not be found."
            : "We couldn't load this collection.",
        );
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadCategory();

    return () => {
      alive = false;
    };
  }, [slug]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    let result = data.products.filter((product) => {
      if (!query) return true;

      return [
        product.name,
        product.brand,
        product.description,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query),
        );
    });

    if (stockFilter === "in-stock") {
      result = result.filter(
        (product) =>
          Number(
            product.available_stock ??
              product.stock ??
              product.quantity ??
              0,
          ) > 0,
      );
    }

    if (stockFilter === "out-of-stock") {
      result = result.filter(
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

    if (sort === "price-low") {
      result.sort(
        (a, b) => Number(a.price || 0) - Number(b.price || 0),
      );
    }

    if (sort === "price-high") {
      result.sort(
        (a, b) => Number(b.price || 0) - Number(a.price || 0),
      );
    }

    if (sort === "name") {
      result.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || "")),
      );
    }

    return result;
  }, [data.products, search, sort, stockFilter]);

  const clearFilters = () => {
    setSearch("");
    setSort("default");
    setStockFilter("all");
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 sm:py-10">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-xs text-[#737A74]">
        <Link to="/" className="hover:text-[#486B57]">
          Home
        </Link>
        <span>/</span>
        <Link to="/categories" className="hover:text-[#486B57]">
          Categories
        </Link>
        <span>/</span>
        <span className="text-[#1F2521]">{data.category?.name}</span>
      </div>

      {loading ? (
        <LoadingState label="Loading collection…" />
      ) : error ? (
        <EmptyState
          title="Collection unavailable"
          text={error}
          action="Browse categories"
          to="/categories"
        />
      ) : (
        <>
          {/* Compact Category Hero */}
          <section className="relative mb-10 overflow-hidden rounded-[1.75rem]">
            <div className="relative h-[250px] sm:h-[280px]">
              {data.category.image_url ? (
                <img
                  src={data.category.image_url}
                  alt={data.category.name}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-[#DCE7DE]" />
              )}

              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />

              <div className="relative flex h-full max-w-xl flex-col justify-end px-7 pb-8 text-white sm:px-10 sm:pb-10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                  TerraLens collection
                </p>

                <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {data.category.name}
                </h1>

                <p className="mt-2 text-sm text-white/75">
                  {data.products.length}{" "}
                  {data.products.length === 1
                    ? "product"
                    : "products"}{" "}
                  to explore
                </p>
              </div>
            </div>
          </section>

          {/* Products */}
          <section>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#486B57]">
                  Collection
                </p>

                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[#1F2521]">
                  {filteredProducts.length}{" "}
                  {filteredProducts.length === 1
                    ? "product"
                    : "products"}
                </h2>
              </div>

              <Link
                to="/shop"
                className="hidden items-center gap-2 text-sm font-medium text-[#486B57] hover:text-[#385744] sm:flex"
              >
                View all products
                <ArrowRight size={15} />
              </Link>
            </div>

            {/* Compact Toolbar */}
            <div className="mb-7 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8B938D]"
                />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${data.category.name.toLowerCase()}...`}
                  className="h-11 w-full rounded-xl border border-[#E3E5DF] bg-white pl-10 pr-9 text-sm outline-none transition focus:border-[#486B57] focus:ring-2 focus:ring-[#486B57]/10"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737A74]"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <select
                  value={stockFilter}
                  onChange={(event) =>
                    setStockFilter(event.target.value)
                  }
                  className="h-11 rounded-xl border border-[#E3E5DF] bg-white px-3 text-sm outline-none focus:border-[#486B57]"
                >
                  <option value="all">All</option>
                  <option value="in-stock">In stock</option>
                  <option value="out-of-stock">Out of stock</option>
                </select>

                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="h-11 rounded-xl border border-[#E3E5DF] bg-white px-3 text-sm outline-none focus:border-[#486B57]"
                >
                  <option value="default">Featured</option>
                  <option value="name">Name</option>
                  <option value="price-low">Price: Low</option>
                  <option value="price-high">Price: High</option>
                </select>

                {(search ||
                  sort !== "default" ||
                  stockFilter !== "all") && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="hidden items-center gap-1 px-2 text-xs font-medium text-[#59645c] hover:text-[#486B57] sm:flex"
                  >
                    <X size={13} />
                    Clear
                  </button>
                )}
              </div>
            </div>

            {filteredProducts.length ? (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    imageUrl={data.images[product.id]}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#E3E5DF] bg-white px-6 py-14 text-center">
                <Search
                  size={22}
                  className="mx-auto text-[#486B57]"
                />

                <h3 className="mt-4 font-semibold text-[#1F2521]">
                  No products found
                </h3>

                <p className="mt-2 text-sm text-[#737A74]">
                  Try another search or clear your filters.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-full bg-[#486B57] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#385744]"
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Categories() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;

    Promise.all([
      api.get("/categories/"),
      api.get("/products/"),
    ])
      .then(([categoryResponse, productResponse]) => {
        if (!alive) return;

        setCategories(categoryResponse.data);
        setProducts(productResponse.data);
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

  const categoryCounts = useMemo(() => {
    return products.reduce((counts, product) => {
      if (product.category_id) {
        counts[product.category_id] =
          (counts[product.category_id] || 0) + 1;
      }

      return counts;
    }, {});
  }, [products]);

  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = categories.filter((category) =>
      String(category.name || "")
        .toLowerCase()
        .includes(query),
    );

    return [...result].sort((a, b) => {
      if (sort === "products") {
        return (
          (categoryCounts[b.id] || 0) -
          (categoryCounts[a.id] || 0)
        );
      }

      return String(a.name || "").localeCompare(
        String(b.name || ""),
      );
    });
  }, [categories, categoryCounts, search, sort]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 sm:py-12">
      {/* Header */}
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#486B57]">
          Explore TerraLens
        </p>

        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#1F2521] sm:text-5xl">
          Find your kind of thing.
        </h1>

        <p className="mt-3 text-sm leading-7 text-[#737A74] sm:text-base">
          Browse our collections and discover products selected for
          everyday living.
        </p>
      </div>

      {loading ? (
        <div className="mt-10">
          <LoadingState label="Loading collections…" />
        </div>
      ) : error ? (
        <div className="mt-10">
          <EmptyState
            title="Couldn't load categories"
            text="Please try again in a moment."
          />
        </div>
      ) : (
        <>
          {/* Search row */}
          <div className="mt-9 flex flex-col gap-3 border-b border-[#E3E5DF] pb-5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-0 top-1/2 -translate-y-1/2 text-[#737A74]"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search categories..."
                className="h-10 w-full border-0 bg-transparent pl-7 pr-8 text-sm text-[#1F2521] outline-none placeholder:text-[#9AA19B]"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737A74] hover:text-[#1F2521]"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-[#737A74]">
              <SlidersHorizontal size={15} />

              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="border-0 bg-transparent pr-7 text-sm font-medium text-[#1F2521] outline-none"
              >
                <option value="name">Name A–Z</option>
                <option value="products">Most products</option>
              </select>
            </div>
          </div>

          {/* Result count */}
          <div className="mt-7 flex items-center justify-between">
            <p className="text-sm text-[#737A74]">
              {filteredCategories.length}{" "}
              {filteredCategories.length === 1
                ? "collection"
                : "collections"}
            </p>
          </div>

          {/* Category grid */}
          {filteredCategories.length ? (
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  count={categoryCounts[category.id] || 0}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <Search
                size={22}
                className="mx-auto text-[#486B57]"
              />

              <h2 className="mt-4 font-semibold text-[#1F2521]">
                No collections found
              </h2>

              <p className="mt-2 text-sm text-[#737A74]">
                Try another search term.
              </p>
            </div>
          )}

          {/* Small bottom CTA */}
          <div className="mt-12 flex flex-col gap-4 border-t border-[#E3E5DF] pt-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1F2521]">
                Want to browse everything?
              </p>

              <p className="mt-1 text-sm text-[#737A74]">
                Explore the complete TerraLens collection.
              </p>
            </div>

            <Link
              to="/shop"
              className="group inline-flex items-center gap-2 text-sm font-semibold text-[#486B57] hover:text-[#385744]"
            >
              Shop all products
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

export default Categories;