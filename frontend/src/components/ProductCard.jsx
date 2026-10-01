import { Heart, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import api from "../services/api";
import useAuth from "../context/useAuth";
import { Price } from "./Storefront";

function ProductCard({ product, imageUrl }) {
  const { isAuthenticated, refreshCounts } = useAuth();
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const stock = Number(product.available_stock ?? product.stock ?? 0);
  const toggleWishlist = async () => {
    if (!isAuthenticated) {
      setNotice("Sign in to save products.");
      return;
    }
    try {
      if (saved) {
        await api.delete(`/wishlist/${product.id}`);
        setSaved(false);
        setNotice("Removed from wishlist.");
      } else {
        await api.post(`/wishlist/${product.id}`);
        setSaved(true);
        setNotice("Saved to wishlist.");
      }
      await refreshCounts();
    } catch (error) {
      setNotice(error.response?.data?.detail || "Unable to update wishlist.");
    }
  };
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[#E3E5DF] bg-white transition hover:-translate-y-1 hover:shadow-[0_12px_30px_-24px_#1f2521]">
      <button
        type="button"
        onClick={toggleWishlist}
        aria-label={`${saved ? "Remove" : "Add"} ${product.name} ${saved ? "from" : "to"} wishlist`}
        className="absolute right-3 top-3 z-10 rounded-full border border-[#E3E5DF] bg-white p-2 text-[#486B57] hover:bg-[#DCE7DE]"
      >
        <Heart size={17} fill={saved ? "currentColor" : "none"} />
      </button>
      <Link to={`/products/${product.id}`} className="block">
        <div className="aspect-[4/3] overflow-hidden bg-[#F0F1EC]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-end bg-[radial-gradient(ellipse_at_25%_25%,white_0,transparent_55%),linear-gradient(140deg,#edf0e9,#dfe7dc)] p-5">
              <span className="text-xs uppercase tracking-[.18em] text-[#738078]">
                TerraLens collection
              </span>
            </div>
          )}
        </div>
      </Link>
      <div className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-[.14em] text-[#737A74]">
          {product.brand || "TerraLens"}
        </p>
        <Link to={`/products/${product.id}`}>
          <h3 className="mt-1 min-h-12 font-medium leading-6 hover:text-[#486B57]">
            {product.name}
          </h3>
        </Link>
        <div className="mt-2 flex items-center gap-1 text-[#486B57]">
          <Star size={14} fill="currentColor" />
          <span className="text-xs text-[#737A74]">
            {Number(product.rating || 0).toFixed(1)}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Price value={product.price} className="font-semibold" />
          <span
            className={`text-xs ${stock ? "text-[#486B57]" : "text-[#9a5547]"}`}
          >
            {stock ? "In stock" : "Sold out"}
          </span>
        </div>
        {notice && (
          <p role="status" className="mt-2 text-xs text-[#737A74]">
            {notice}
          </p>
        )}
      </div>
    </article>
  );
}
export default ProductCard;
