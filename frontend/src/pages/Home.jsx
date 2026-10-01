import { useContext, useEffect, useState } from "react";
import {
  ArrowRight,
  Heart,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { Link } from "react-router-dom";

import api from "../services/api";
import ProductCard from "../components/ProductCard";
import {
  CategoryCard,
  EmptyState,
  LoadingState,
  SectionTitle,
  WhyTerraLens,
} from "../components/Storefront";
import { SiteBrandingContext } from "../context/site-branding-context";

const heroContent = {
  eyebrow: "Considered living",
  title: "Thoughtfully selected products for everyday living.",
  subtitle:
    "Discover quality products, everyday essentials and special finds selected with care by TerraLens.",
  primaryText: "Shop the collection",
  primaryLink: "/shop",
  secondaryText: "Explore deals",
  secondaryLink: "/deals",
};

function Home() {
  const { heroImageUrl } = useContext(SiteBrandingContext);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeDeals, setActiveDeals] = useState([]);
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    Promise.all([
      api.get("/products/"),
      api.get("/categories/"),
      api.get("/discounts/"),
    ])
      .then(async ([productResponse, categoryResponse, discountResponse]) => {
        if (!alive) return;

        const productData = productResponse.data;
        const categoryData = categoryResponse.data;
        const discountData = discountResponse.data;

        setProducts(productData);
        setCategories(categoryData);

        const now = Date.now();

        setActiveDeals(
          discountData.filter(
            (deal) =>
              deal.is_active &&
              new Date(deal.start_date).getTime() <= now &&
              new Date(deal.end_date).getTime() >= now,
          ),
        );

        /*
         * Only load images for the products that will actually
         * appear on the homepage.
         */
        const topProducts = productData.slice(0, 5);

        const imageResults = await Promise.all(
          topProducts.map(async (product) => {
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

        if (alive) {
          setImages(
            Object.fromEntries(
              imageResults.filter(([, url]) => url),
            ),
          );
        }
      })
      .catch(() => {
        if (alive) {
          setError("We couldn't load the store right now.");
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  /*
   * Homepage intentionally shows only the first 5 products.
   * New products can be added without making the homepage
   * continuously longer.
   */
  const featuredProducts = products.slice(0, 5);

  return (
    <main className="overflow-hidden">
      {/* =====================================================
          HERO
      ===================================================== */}
      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-7 lg:pt-8">
        <div
          className="relative min-h-[500px] overflow-hidden rounded-[2rem] bg-[#DCE7DE] bg-cover bg-center sm:min-h-[560px]"
          style={{
            backgroundImage: heroImageUrl
              ? `linear-gradient(90deg, rgba(18,28,22,.74) 0%, rgba(18,28,22,.52) 38%, rgba(18,28,22,.20) 70%, rgba(18,28,22,.04) 100%), url("${heroImageUrl}")`
              : "linear-gradient(135deg, #DCE7DE 0%, #E9EEE8 55%, #D2E0D5 100%)",
          }}
        >
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />

          <div className="pointer-events-none absolute -bottom-32 -right-12 h-96 w-96 rounded-full border border-white/10" />

          <div className="relative flex min-h-[500px] max-w-2xl flex-col justify-center px-6 py-14 text-white sm:min-h-[560px] sm:px-10 md:px-14">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-white/80">
              <Sparkles size={14} />
              {heroContent.eyebrow}
            </div>

            <h1 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-5xl md:text-6xl">
              {heroContent.title}
            </h1>

            <p className="mt-6 max-w-lg text-sm leading-7 text-white/80 sm:text-base">
              {heroContent.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={heroContent.primaryLink}
                className="inline-flex items-center justify-center rounded-full bg-[#486B57] px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition duration-200 hover:-translate-y-0.5 hover:bg-[#3D5D4B]"
              >
                {heroContent.primaryText}
                <ArrowRight className="ml-2" size={16} />
              </Link>

              <Link
                to={heroContent.secondaryLink}
                className="inline-flex items-center justify-center rounded-full border border-white/45 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:bg-white/15"
              >
                {heroContent.secondaryText}
                <ArrowRight className="ml-2" size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          TRUST STRIP
      ===================================================== */}
      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6">
        <div className="grid overflow-hidden rounded-2xl border border-[#E3E5DF] bg-white sm:grid-cols-3">
          <div className="flex items-center gap-3 border-b border-[#E3E5DF] px-5 py-4 sm:border-b-0 sm:border-r">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DCE7DE] text-[#486B57]">
              <Heart size={16} />
            </span>

            <div>
              <p className="text-sm font-semibold text-[#1F2521]">
                Thoughtfully selected
              </p>

              <p className="text-xs text-[#737A74]">
                Products worth discovering
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-[#E3E5DF] px-5 py-4 sm:border-b-0 sm:border-r">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DCE7DE] text-[#486B57]">
              <Truck size={16} />
            </span>

            <div>
              <p className="text-sm font-semibold text-[#1F2521]">
                Simple shopping
              </p>

              <p className="text-xs text-[#737A74]">
                Clear and straightforward
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#DCE7DE] text-[#486B57]">
              <ShieldCheck size={16} />
            </span>

            <div>
              <p className="text-sm font-semibold text-[#1F2521]">
                Secure checkout
              </p>

              <p className="text-xs text-[#737A74]">
                Shop with confidence
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          SHOP BY CATEGORY
          Horizontal auto-scrolling carousel
      ===================================================== */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionTitle
            eyebrow="Browse the edit"
            title="Shop by category"
            to="/categories"
          />
        </div>

        {loading ? (
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <LoadingState />
          </div>
        ) : categories.length ? (
          <div className="relative mt-7">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#F5F5F1] to-transparent sm:w-24" />

            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#F5F5F1] to-transparent sm:w-24" />

            <div
              className="category-carousel overflow-hidden"
              onMouseEnter={(event) => {
                event.currentTarget
                  .querySelector(".category-track")
                  ?.classList.add("paused");
              }}
              onMouseLeave={(event) => {
                event.currentTarget
                  .querySelector(".category-track")
                  ?.classList.remove("paused");
              }}
            >
              <div className="category-track flex w-max gap-4 px-4 sm:px-6">
                {[...categories, ...categories].map(
                  (category, index) => (
                    <div
                      key={`${category.id}-${index}`}
                      className="w-[280px] shrink-0 sm:w-[320px] lg:w-[350px]"
                    >
                      <CategoryCard category={category} />
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <EmptyState
              title="Categories are coming soon"
              text="Browse the full TerraLens collection in the meantime."
              action="Shop all products"
              to="/shop"
            />
          </div>
        )}
      </section>

      {/* =====================================================
          DEALS
      ===================================================== */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#3F5F4D] px-6 py-10 text-white sm:px-10 md:px-14 md:py-12">
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full border border-white/10" />

          <div className="pointer-events-none absolute -bottom-40 right-24 h-96 w-96 rounded-full border border-white/5" />

          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#D2DED4]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D2DED4]" />

                Special offers

                <span className="text-white/40">
                  ·
                </span>

                {activeDeals.length} active
              </div>

              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Better products.
                <br className="hidden sm:block" />
                Better prices.
              </h2>

              <p className="mt-4 max-w-xl text-sm leading-6 text-white/70">
                Discover limited-time offers and selected products available
                for a little extra value.
              </p>
            </div>

            <Link
              to="/deals"
              className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-[#1c531d] px-6 py-3.5 text-sm font-semibold text-[#3F5F4D] transition duration-200 hover:-translate-y-0.5 hover:bg-lightgreen"
            >
              Explore deals
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          NEW ARRIVALS
          Limited to 5 products
      ===================================================== */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
        <SectionTitle
          eyebrow="Freshly added"
          title="New arrivals"
          to="/shop"
          linkText="View all products"
        />

        {loading ? (
          <LoadingState />
        ) : error ? (
          <p className="text-sm text-[#737A74]">
            {error}
          </p>
        ) : featuredProducts.length ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-5">
            {featuredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                imageUrl={images[product.id]}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No products yet"
            text="Our collection will appear here as soon as products are available."
            action="Explore the shop"
            to="/shop"
          />
        )}
      </section>

      {/* =====================================================
          WHY TERRALENS
      ===================================================== */}
      <WhyTerraLens />

      {/* =====================================================
          FINAL CTA
      ===================================================== */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 md:pb-20">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#D7E0D8] bg-[#E4EBE4] px-6 py-10 sm:px-10 md:px-14 md:py-12">
          <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-[#486B57]/10" />

          <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#486B57]">
                Your next favourite
              </p>

              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#1F2521] sm:text-3xl">
                Find something worth bringing home.
              </h2>

              <p className="mt-3 text-sm leading-6 text-[#737A74]">
                Explore the full TerraLens collection and discover something
                made for your everyday.
              </p>
            </div>

            <Link
              to="/shop"
              className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-[#486B57] px-6 py-3.5 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:bg-[#3D5D4B]"
            >
              Explore the collection
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;