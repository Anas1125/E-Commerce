import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import ProductCard from "../components/ProductCard";
import api from "../services/api";
import { EmptyState, LoadingState, PageIntro } from "../components/Storefront";

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
    Promise.all([api.get("/products/"), api.get("/categories/")])
      .then(async ([productResponse, categoryResponse]) => {
        if (!alive) return;
        setProducts(productResponse.data);
        setCategories(categoryResponse.data);
        const imageResults = await Promise.all(
          productResponse.data.map(async (product) => {
            try {
              const response = await api.get(`/products/${product.id}/images`);
              return [
                product.id,
                response.data.find((image) => image.is_primary)?.image_url ||
                  response.data[0]?.image_url,
              ];
            } catch {
              return [product.id, null];
            }
          }),
        );
        if (alive)
          setImages(Object.fromEntries(imageResults.filter(([, url]) => url)));
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const brands = [
    ...new Set(products.map((product) => product.brand).filter(Boolean)),
  ].sort();
  const filtered = useMemo(() => {
    const results = products.filter((product) => {
      const text =
        `${product.name} ${product.brand || ""} ${product.description || ""}`.toLowerCase();
      return (
        (!search || text.includes(search.toLowerCase())) &&
        (category === "all" || String(product.category_id) === category) &&
        (brand === "all" || product.brand === brand) &&
        (minPrice === "" || Number(product.price) >= Number(minPrice)) &&
        (maxPrice === "" || Number(product.price) <= Number(maxPrice)) &&
        (availability === "all" ||
          (availability === "in" ? product.stock > 0 : product.stock <= 0))
      );
    });
    if (sort === "low") results.sort((a, b) => a.price - b.price);
    if (sort === "high") results.sort((a, b) => b.price - a.price);
    if (sort === "rating") results.sort((a, b) => b.rating - a.rating);
    if (sort === "new") results.sort((a, b) => b.id - a.id);
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
  };

  const filters = (
    <>
      <label className="block text-sm font-medium text-[#465149]">
        Search products
        <input
          className="field mt-2"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Name, brand or details"
        />
      </label>
      <label className="block text-sm font-medium text-[#465149]">
        Category
        <select
          className="field mt-2"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-[#465149]">
        Brand
        <select
          className="field mt-2"
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
        >
          <option value="all">All brands</option>
          {brands.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-medium text-[#465149]">
          Price range
        </legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            type="number"
            min="0"
            aria-label="Minimum price"
            placeholder="Min ₹"
            className="field"
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
          />
          <input
            type="number"
            min="0"
            aria-label="Maximum price"
            placeholder="Max ₹"
            className="field"
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
          />
        </div>
      </fieldset>
      <label className="block text-sm font-medium text-[#465149]">
        Availability
        <select
          className="field mt-2"
          value={availability}
          onChange={(event) => setAvailability(event.target.value)}
        >
          <option value="all">All products</option>
          <option value="in">In stock</option>
          <option value="out">Out of stock</option>
        </select>
      </label>
      <button
        type="button"
        className="text-left text-sm font-medium text-[#486B57] hover:text-[#344d3e]"
        onClick={clearFilters}
      >
        Clear all filters
      </button>
    </>
  );

  const sortControl = (
    <label className="flex items-center gap-2 text-sm text-[#59645c]">
      Sort
      <select
        aria-label="Sort products"
        className="field min-w-40 py-2"
        value={sort}
        onChange={(event) => setSort(event.target.value)}
      >
        <option value="default">Recommended</option>
        <option value="low">Price: Low to High</option>
        <option value="high">Price: High to Low</option>
        <option value="rating">Highest Rated</option>
        <option value="new">Newest</option>
      </select>
    </label>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
      <PageIntro
        eyebrow="The collection"
        title="Shop"
        description="Explore considered essentials and finds for everyday living."
      >
        {sortControl}
      </PageIntro>
      <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
        <button
          type="button"
          className="button-secondary inline-flex items-center gap-2 px-4 py-2.5"
          onClick={() => setShowFilters(true)}
        >
          <SlidersHorizontal size={16} />
          Filters
        </button>
        <span className="text-sm text-[#737A74]">
          {loading ? "Loading…" : `${filtered.length} items`}
        </span>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-9">
        <aside className="hidden h-fit space-y-5 rounded-2xl border border-[#E3E5DF] bg-white p-5 lg:sticky lg:top-24 lg:block">
          <div className="flex items-center justify-between border-b border-[#E3E5DF] pb-3">
            <div>
              <p className="text-sm font-semibold">Refine your search</p>
              <p className="mt-1 text-xs text-[#737A74]">
                Narrow the collection
              </p>
            </div>
            <SlidersHorizontal size={17} className="text-[#486B57]" />
          </div>
          {filters}
        </aside>
        <section className="min-w-0">
          <div className="mb-5 hidden border-b border-[#E3E5DF] pb-4 lg:block">
            <p className="text-sm text-[#737A74]">
              {loading
                ? "Loading products…"
                : `Showing ${filtered.length} ${filtered.length === 1 ? "product" : "products"}`}
            </p>
          </div>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <EmptyState
              title="Shop unavailable"
              text="We couldn’t load products. Please try again."
            />
          ) : filtered.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:gap-x-5 sm:gap-y-9 xl:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  imageUrl={images[product.id]}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E3E5DF] bg-white px-6 py-14 text-center">
              <h2 className="text-lg font-semibold">
                No products match those filters
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#737A74]">
                Try a different search or clear a filter to see more of the
                collection.
              </p>
              <button
                type="button"
                className="button-primary mt-6"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>
      </div>
      {showFilters && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 h-full w-full bg-black/35"
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
                <p className="eyebrow">The collection</p>
                <h2
                  id="mobile-filter-title"
                  className="mt-1 text-lg font-semibold"
                >
                  Filters
                </h2>
              </div>
              <button
                type="button"
                className="rounded-full p-2 hover:bg-[#F0F1EC]"
                aria-label="Close filters"
                onClick={() => setShowFilters(false)}
              >
                <X size={19} />
              </button>
            </header>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {filters}
            </div>
            <div className="border-t border-[#E3E5DF] bg-white p-4">
              <button
                type="button"
                className="button-primary w-full"
                onClick={() => setShowFilters(false)}
              >
                Show {filtered.length}{" "}
                {filtered.length === 1 ? "item" : "items"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default Shop;
