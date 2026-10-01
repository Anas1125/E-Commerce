import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";
import ProductCard from "../components/ProductCard";
import {
  CategoryCard,
  EmptyState,
  LoadingState,
  PageIntro,
} from "../components/Storefront";

export function CategoryPage() {
  const { slug } = useParams();
  const [data, setData] = useState({
    products: [],
    category: null,
    images: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([api.get("/categories/"), api.get("/products/")])
      .then(async ([categoryResponse, productResponse]) => {
        const category = categoryResponse.data.find(
          (item) => item.slug === slug,
        );
        if (!category) throw new Error("Category not found");
        const products = productResponse.data.filter(
          (product) => product.category_id === category.id,
        );
        const images = await Promise.all(
          products.map(async (product) => {
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
          setData({
            category,
            products,
            images: Object.fromEntries(images.filter(([, url]) => url)),
          });
      })
      .catch(
        (requestError) =>
          alive &&
          setError(
            requestError.message === "Category not found"
              ? "This collection could not be found."
              : "We couldn’t load this collection.",
          ),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-5 text-xs text-[#737A74]">
        <Link to="/">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/categories">Categories</Link>
        {data.category && (
          <>
            <span className="mx-2">/</span>
            {data.category.name}
          </>
        )}
      </div>
      {loading ? (
        <LoadingState label="Preparing this collection…" />
      ) : error ? (
        <EmptyState
          title="Collection unavailable"
          text={error}
          action="Browse all categories"
          to="/categories"
        />
      ) : (
        <>
          <div className="relative mb-10 overflow-hidden rounded-3xl bg-[#E2E9E1] px-7 py-10 md:px-12">
            {data.category.image_url && (
              <img
                src={data.category.image_url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div
              className={`absolute inset-0 ${data.category.image_url ? "bg-gradient-to-r from-black/65 to-black/20" : "bg-[radial-gradient(ellipse_at_top_right,_#fff8,_transparent_60%),linear-gradient(145deg,#e8eee7,#cddbd0)]"}`}
            />
            <div
              className={`relative ${data.category.image_url ? "text-white" : ""}`}
            >
              <p className="eyebrow">TerraLens collection</p>
              <h1 className="mt-3 text-3xl font-semibold">
                {data.category.name}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 opacity-80">
                A considered selection from the TerraLens collection.
              </p>
            </div>
          </div>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {data.products.length}{" "}
              {data.products.length === 1 ? "product" : "products"}
            </h2>
            <Link to="/shop" className="text-sm text-[#486B57]">
              All products →
            </Link>
          </div>
          {data.products.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  imageUrl={data.images[product.id]}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing in this collection yet"
              text="Try another category or explore the full shop."
              action="Browse the shop"
            />
          )}
        </>
      )}
    </div>
  );
}

function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get("/categories/")
      .then((response) => setCategories(response.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <PageIntro
        eyebrow="Find your kind of thing"
        title="All Categories"
        description="Browse the TerraLens collection by category."
      />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState
          title="Couldn’t load categories"
          text="Please try again in a moment."
        />
      ) : categories.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No categories yet"
          text="Check back as our collection grows."
          action="Shop all products"
        />
      )}
    </div>
  );
}

export default Categories;
