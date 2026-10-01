import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Trash2 } from "lucide-react";
import api from "../services/api";
import useAuth from "../context/useAuth";
import {
  EmptyState,
  LoadingState,
  PageIntro,
  Price,
} from "../components/Storefront";

function Wishlist() {
  const { isAuthenticated, refreshCounts } = useAuth();
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const [wishlist, productResponse] = await Promise.all([
        api.get("/wishlist/"),
        api.get("/products/"),
      ]);
      setItems(wishlist.data.items);
      setProducts(
        Object.fromEntries(
          productResponse.data.map((product) => [product.id, product]),
        ),
      );
      setError("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail || "Unable to load wishlist.",
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const remove = async (id) => {
    try {
      await api.delete(`/wishlist/${id}`);
      setItems((current) => current.filter((item) => item.product_id !== id));
      await refreshCounts();
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail || "Unable to remove this item.",
      );
    }
  };

  const addToCart = async (id) => {
    try {
      await api.post("/cart/items", { product_id: id, quantity: 1 });
      await refreshCounts();
      setError("Added to your cart.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail ||
          "Unable to add this item to cart.",
      );
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <PageIntro
        eyebrow="Saved for later"
        title="Your Wishlist"
        description="A place for the things you’d like to come back to."
      />
      {loading ? (
        <LoadingState />
      ) : !isAuthenticated ? (
        <EmptyState
          title="Sign in to see your wishlist"
          text="Save favourites and find them here next time."
          action="Sign in"
          to="/login"
        />
      ) : error && items.length === 0 ? (
        <EmptyState title="Wishlist unavailable" text={error} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          text="Tap the heart on a product to keep it close."
          action="Explore the shop"
        />
      ) : (
        <>
          {error && (
            <p role="status" className="mb-4 text-sm text-[#737A74]">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.product_id}
                className="overflow-hidden rounded-2xl border border-[#E3E5DF] bg-white"
              >
                <Link
                  to={`/products/${item.product_id}`}
                  className="block aspect-[4/3] bg-[#F0F1EC]"
                >
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.product_name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </Link>
                <div className="p-5">
                  <p className="text-xs uppercase tracking-wide text-[#737A74]">
                    {products[item.product_id]?.brand || "TerraLens"}
                  </p>
                  <Link
                    to={`/products/${item.product_id}`}
                    className="mt-1 block font-medium"
                  >
                    {item.product_name}
                  </Link>
                  <Price
                    value={item.price}
                    className="mt-3 block font-semibold"
                  />
                  <div className="mt-5 flex gap-2">
                    <button
                      className="button-primary inline-flex flex-1 gap-2"
                      onClick={() => addToCart(item.product_id)}
                    >
                      <ShoppingBag size={16} />
                      Add to cart
                    </button>
                    <button
                      className="button-secondary"
                      aria-label={`Remove ${item.product_name}`}
                      onClick={() => remove(item.product_id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Wishlist;
