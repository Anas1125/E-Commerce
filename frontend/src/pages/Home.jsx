import { useContext, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";

import api from "../services/api";
import ProductCard from "../components/ProductCard";
import { EmptyState, LoadingState } from "../components/Storefront";
import { SiteBrandingContext } from "../context/site-branding-context";

const RECENTLY_VIEWED_KEY = "terralens_recently_viewed";
const MAX_RECENT_PRODUCTS = 12;
const PRODUCTS_TO_LOAD_IMAGES = 30;
const SECTION_SIZE = 5;
const MAX_SLIDES = 5;
const SLIDE_INTERVAL_MS = 4500;
const IMAGE_REQUEST_BATCH_SIZE = 6;

function readRecentlyViewed() {
  try {
    const stored = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(Number).filter((id) => Number.isFinite(id));
  } catch {
    return [];
  }
}

function saveRecentlyViewed(ids) {
  try {
    window.localStorage.setItem(
      RECENTLY_VIEWED_KEY,
      JSON.stringify(ids.slice(0, MAX_RECENT_PRODUCTS)),
    );
  } catch {
    // Ignore localStorage errors.
  }
}

function getProductCategoryId(product) {
  return product.category_id ?? product.category?.id ?? product.categoryId ?? null;
}

function getProductBrandId(product) {
  return product.brand_id ?? product.brand?.id ?? product.brandId ?? null;
}

function getProductBrandName(product) {
  if (typeof product.brand === "string") return product.brand;

  return product.brand?.name ?? product.brand_name ?? "";
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

function getProductPrice(product) {
  const price = Number(product.price);

  return Number.isFinite(price) ? price : 0;
}

function getInlineImageUrl(product) {
  return (
    product.primary_image_url ??
    product.primary_image?.image_url ??
    product.image_url ??
    null
  );
}

function sameId(a, b) {
  return a != null && b != null && String(a) === String(b);
}

function getDiscountAmount(discount, product) {
  if (!discount || !product) return 0;

  const price = getProductPrice(product);
  if (price <= 0) return 0;

  const value = Number(discount.value) || 0;

  if (discount.discount_type === "percentage") {
    return Math.min(price, price * (value / 100));
  }

  if (discount.discount_type === "fixed") {
    return Math.min(price, value);
  }

  return 0;
}

function getDiscountPercentage(discount, product) {
  const price = getProductPrice(product);
  if (price <= 0) return 0;

  return Math.max(
    0,
    Math.min(100, (getDiscountAmount(discount, product) / price) * 100),
  );
}

function discountAppliesToProduct(discount, product) {
  if (discount.product_id) {
    return sameId(discount.product_id, product.id);
  }

  if (discount.category_id) {
    return sameId(discount.category_id, getProductCategoryId(product));
  }

  return true;
}

function getEffectiveDiscount(product, discounts) {
  let best = null;
  let bestAmount = 0;

  for (const discount of discounts) {
    if (!discountAppliesToProduct(discount, product)) continue;

    const amount = getDiscountAmount(discount, product);

    if (amount > bestAmount) {
      best = discount;
      bestAmount = amount;
    }
  }

  return best;
}

function formatRupees(value) {
  return `₹${Number(value).toLocaleString("en-IN")}`;
}

function getDiscountLabel(discount, product) {
  if (discount.discount_type === "percentage") {
    return `${Number(discount.value)}% OFF`;
  }

  return `${formatRupees(getDiscountAmount(discount, product))} OFF`;
}


function SectionCard({ title, subtitle, linkTo, className = "pt-5", children }) {
  return (
    <section className={`mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white">
        <div className="flex items-center justify-between border-b border-[#EEEEEE] px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-[#212121]">{title}</h2>
            <p className="mt-0.5 text-xs text-[#878787]">{subtitle}</p>
          </div>

          <Link
            to={linkTo}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2874F0] hover:underline"
          >
            View all
            <ChevronRight size={14} />
          </Link>
        </div>

        {children}
      </div>
    </section>
  );
}

function TrustItem({ icon: Icon, title, text, className = "" }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-4 ${className}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2874F0]">
        <Icon size={17} />
      </span>

      <div>
        <p className="text-sm font-semibold text-[#212121]">{title}</p>
        <p className="mt-0.5 text-xs text-[#878787]">{text}</p>
      </div>
    </div>
  );
}

function StatItem({ value, title, text, valueClass = "text-[#2874F0]", className = "" }) {
  return (
    <div className={`px-5 py-5 ${className}`}>
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-sm font-medium text-[#212121]">{title}</p>
      <p className="mt-1 text-xs text-[#878787]">{text}</p>
    </div>
  );
}

function Home() {
  const { heroImageUrl, siteName = "TerraLens" } = useContext(SiteBrandingContext);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeDeals, setActiveDeals] = useState([]);
  const [images, setImages] = useState({});
  const [recentlyViewed, setRecentlyViewed] = useState(() => readRecentlyViewed());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      const [productResult, categoryResult, discountResult] =
        await Promise.allSettled([
          api.get("/products/"),
          api.get("/categories/"),
          api.get("/discounts/active"),
        ]);

      if (!alive) return;

      if (productResult.status === "rejected") {
        setError("We couldn't load the store right now.");
        setLoading(false);
        return;
      }

      const productData = productResult.value.data || [];
      const categoryData =
        categoryResult.status === "fulfilled" ? categoryResult.value.data || [] : [];
      const discountData =
        discountResult.status === "fulfilled" ? discountResult.value.data || [] : [];

      const now = Date.now();

      const currentDeals = discountData.filter((deal) => {
        if (!deal.is_active) return false;

        const startsAt = deal.start_date ? new Date(deal.start_date).getTime() : 0;
        const endsAt = deal.end_date
          ? new Date(deal.end_date).getTime()
          : Number.POSITIVE_INFINITY;

        if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return false;

        return startsAt <= now && endsAt >= now;
      });

      const inlineImages = {};

      productData.forEach((product) => {
        const url = getInlineImageUrl(product);
        if (url) inlineImages[product.id] = url;
      });

      setProducts(productData);
      setCategories(categoryData);
      setActiveDeals(currentDeals);
      setImages(inlineImages);
      setLoading(false);

      const productIds = new Set(productData.map((product) => Number(product.id)));

      const dealProductIds = currentDeals
        .map((deal) => Number(deal.product_id))
        .filter((id) => Number.isFinite(id) && productIds.has(id));

      const firstProductIds = productData
        .slice(0, PRODUCTS_TO_LOAD_IMAGES)
        .map((product) => Number(product.id));

      const idsToLoad = [...new Set([...dealProductIds, ...firstProductIds])].filter(
        (id) => !inlineImages[id],
      );

      for (let i = 0; i < idsToLoad.length; i += IMAGE_REQUEST_BATCH_SIZE) {
        const batch = idsToLoad.slice(i, i + IMAGE_REQUEST_BATCH_SIZE);

        const results = await Promise.all(
          batch.map(async (productId) => {
            try {
              const response = await api.get(`/products/${productId}/images`);
              const productImages = response.data || [];

              const primaryImage =
                productImages.find((image) => image.is_primary) || productImages[0];

              return [productId, primaryImage?.image_url || null];
            } catch {
              return [productId, null];
            }
          }),
        );

        if (!alive) return;

        const loaded = Object.fromEntries(results.filter(([, url]) => Boolean(url)));

        if (Object.keys(loaded).length) {
          setImages((current) => ({ ...current, ...loaded }));
        }
      }
    }

    load().catch(() => {
      if (!alive) return;

      setError("We couldn't load the store right now.");
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    saveRecentlyViewed(recentlyViewed);
  }, [recentlyViewed]);

  const trackProductView = (product) => {
    const productId = Number(product.id);
    if (!Number.isFinite(productId)) return;

    setRecentlyViewed((current) =>
      [productId, ...current.filter((id) => Number(id) !== productId)].slice(
        0,
        MAX_RECENT_PRODUCTS,
      ),
    );
  };

  const dealSlides = useMemo(() => {
    const bestDealByProduct = new Map();

    for (const deal of activeDeals) {
      if (!deal.product_id) continue;

      const product = products.find((item) => sameId(item.id, deal.product_id));
      if (!product || !images[product.id]) continue;

      const existing = bestDealByProduct.get(product.id);

      if (
        !existing ||
        getDiscountAmount(deal, product) > getDiscountAmount(existing.discount, product)
      ) {
        bestDealByProduct.set(product.id, {
          id: deal.id,
          product,
          image: images[product.id],
          discount: deal,
        });
      }
    }

    return [...bestDealByProduct.values()].slice(0, MAX_SLIDES);
  }, [activeDeals, products, images]);

  const currentSlide =
    dealSlides.length > 0 ? Math.min(activeSlide, dealSlides.length - 1) : 0;

  const isAutoPlaying =
    dealSlides.length > 1 && !userPaused && !isHovered && !hasFocus;

  useEffect(() => {
    if (!isAutoPlaying) return undefined;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setActiveSlide((current) =>
        current >= dealSlides.length - 1 ? 0 : current + 1,
      );
    }, SLIDE_INTERVAL_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isAutoPlaying, dealSlides.length, currentSlide]);

  const previousSlide = () => {
    if (dealSlides.length <= 1) return;

    setActiveSlide(currentSlide === 0 ? dealSlides.length - 1 : currentSlide - 1);
  };

  const nextSlide = () => {
    if (dealSlides.length <= 1) return;

    setActiveSlide(currentSlide >= dealSlides.length - 1 ? 0 : currentSlide + 1);
  };

  const topDeals = useMemo(() => {
    if (!products.length) return [];

    const discounted = products
      .map((product) => {
        const discount = getEffectiveDiscount(product, activeDeals);
        if (!discount) return null;

        return {
          product,
          discountPercentage: getDiscountPercentage(discount, product),
          discountAmount: getDiscountAmount(discount, product),
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (b.discountPercentage !== a.discountPercentage) {
          return b.discountPercentage - a.discountPercentage;
        }

        if (b.discountAmount !== a.discountAmount) {
          return b.discountAmount - a.discountAmount;
        }

        return getProductPrice(a.product) - getProductPrice(b.product);
      });

    const selected = discounted.slice(0, SECTION_SIZE).map(({ product }) => product);

    if (selected.length < SECTION_SIZE) {
      const selectedIds = new Set(selected.map((product) => product.id));

      const cheapest = products
        .filter((product) => !selectedIds.has(product.id))
        .sort((a, b) => getProductPrice(a) - getProductPrice(b));

      for (const product of cheapest) {
        if (selected.length >= SECTION_SIZE) break;
        selected.push(product);
      }
    }

    return selected.slice(0, SECTION_SIZE);
  }, [products, activeDeals]);

  const newArrivals = useMemo(() => {
    return [...products]
      .sort((a, b) => {
        const dateDifference = getProductDate(b) - getProductDate(a);

        if (dateDifference !== 0) return dateDifference;

        return Number(b.id) - Number(a.id);
      })
      .slice(0, SECTION_SIZE);
  }, [products]);

  const recommendedProducts = useMemo(() => {
    if (!products.length) return [];

    const viewedProducts = recentlyViewed
      .map((id) => products.find((product) => sameId(product.id, id)))
      .filter(Boolean);

    const viewedIds = new Set(recentlyViewed.map(Number));

    if (!viewedProducts.length) {
      const newArrivalIds = new Set(newArrivals.map((product) => Number(product.id)));

      const candidates = products
        .filter((product) => !newArrivalIds.has(Number(product.id)))
        .sort((a, b) => {
          const stockDifference = Number(b.stock || 0) - Number(a.stock || 0);

          if (stockDifference !== 0) return stockDifference;

          return getProductPrice(a) - getProductPrice(b);
        });

      const selected = [];
      const usedCategories = new Set();

      for (const product of candidates) {
        if (selected.length >= SECTION_SIZE) break;

        const categoryId = getProductCategoryId(product);

        if (categoryId && !usedCategories.has(categoryId)) {
          selected.push(product);
          usedCategories.add(categoryId);
        }
      }

      for (const product of candidates) {
        if (selected.length >= SECTION_SIZE) break;
        if (selected.some((item) => item.id === product.id)) continue;

        selected.push(product);
      }

      return selected.slice(0, SECTION_SIZE);
    }

    const scored = products
      .filter((product) => !viewedIds.has(Number(product.id)))
      .map((product) => {
        const categoryId = getProductCategoryId(product);
        const brandId = getProductBrandId(product);
        const brandName = getProductBrandName(product).trim().toLowerCase();

        let score = 0;

        viewedProducts.forEach((viewed) => {
          const viewedBrandName = getProductBrandName(viewed).trim().toLowerCase();

          if (sameId(categoryId, getProductCategoryId(viewed))) score += 6;
          if (sameId(brandId, getProductBrandId(viewed))) score += 4;
          if (brandName && brandName === viewedBrandName) score += 3;
        });

        if (Number(product.stock || 0) > 0) score += 0.5;

        return { product, score };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        return getProductDate(b.product) - getProductDate(a.product);
      });

    const selected = scored
      .filter(({ score }) => score > 0.5)
      .slice(0, SECTION_SIZE)
      .map(({ product }) => product);

    if (selected.length < SECTION_SIZE) {
      const selectedIds = new Set(selected.map((product) => Number(product.id)));

      const fallback = products
        .filter(
          (product) =>
            !viewedIds.has(Number(product.id)) &&
            !selectedIds.has(Number(product.id)),
        )
        .sort((a, b) => {
          const dateDifference = getProductDate(b) - getProductDate(a);

          if (dateDifference !== 0) return dateDifference;

          return getProductPrice(a) - getProductPrice(b);
        });

      for (const product of fallback) {
        if (selected.length >= SECTION_SIZE) break;
        selected.push(product);
      }
    }

    return selected.slice(0, SECTION_SIZE);
  }, [products, recentlyViewed, newArrivals]);

  const categoryItems = useMemo(() => categories.slice(0, 8), [categories]);

  const renderProductCard = (product) => (
    <div
      key={product.id}
      className="w-[230px] shrink-0 sm:w-[245px]"
      onClick={(event) => {
        if (event.target.closest("a")) trackProductView(product);
      }}
    >
      <ProductCard product={product} imageUrl={images[product.id]} />
    </div>
  );

  const renderProductRow = (items, emptyState) => {
    if (loading) {
      return (
        <div className="p-6">
          <LoadingState />
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6">
          <EmptyState title="Products unavailable" text={error} />
        </div>
      );
    }

    if (!items.length) {
      return (
        <div className="p-6">
          <EmptyState {...emptyState} />
        </div>
      );
    }

    return (
      <div className="flex gap-4 overflow-x-auto p-4 scrollbar-hide sm:p-5">
        {items.map(renderProductCard)}
      </div>
    );
  };

  const statValue = (value) => (loading ? "–" : value);

  return (
    <main className="min-h-screen bg-[#F1F3F6]">
      <SEO
        title="Home"
        description={`Shop quality products at ${siteName}. Discover great deals, trusted products, secure checkout, and reliable delivery.`}
      />

      {/* Category strip */}
      <section className="border-b border-[#E0E0E0] bg-white">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 items-stretch py-2 sm:grid-cols-5 lg:grid-cols-9">
            <Link
              to="/categories"
              className="flex min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-center transition hover:bg-[#F5F5F5]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF2FF] text-sm font-bold text-[#2874F0]">
                All
              </span>

              <span className="text-xs font-medium text-[#212121]">Categories</span>
            </Link>

            {categoryItems.map((category) => (
              <Link
                key={category.id}
                to={`/categories/${category.slug}`}
                className="flex min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-md px-2 py-2 text-center transition hover:bg-[#F5F5F5]"
              >
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt=""
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F1F3F6] text-sm font-bold text-[#2874F0]">
                    {category.name?.charAt(0)?.toUpperCase()}
                  </span>
                )}

                <span className="max-w-[105px] truncate text-[11px] font-medium text-[#212121]">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Hero */}
      <section className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6 lg:px-8">
        <div
          className="relative overflow-hidden rounded-lg bg-[#172337]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setHasFocus(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setHasFocus(false);
            }
          }}
        >
          {dealSlides.length > 0 ? (
            <>
              {/* Fixed height so the container never jumps between slides */}
              <div
                role="region"
                aria-roledescription="carousel"
                aria-label="Featured deals"
                className="relative h-[450px] sm:h-[330px]"
              >
                {dealSlides.map((slide, index) => {
                  const isActive = index === currentSlide;

                  return (
                    <div
                      key={slide.id}
                      role="group"
                      aria-roledescription="slide"
                      aria-label={`${index + 1} of ${dealSlides.length}`}
                      aria-hidden={!isActive}
                      aria-live={isAutoPlaying ? "off" : "polite"}
                      className={`absolute inset-0 transition-opacity duration-700 ${
                        isActive ? "opacity-100" : "pointer-events-none opacity-0"
                      }`}
                    >
                      <Link
                        to={`/products/${slide.product.id}`}
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => trackProductView(slide.product)}
                        className="block h-full cursor-pointer"
                      >
                        <div className="relative h-full overflow-hidden bg-[#172337]">
                          {/* Product image */}
                          <img
                            src={slide.image}
                            alt={slide.product.name}
                            className="absolute bottom-0 left-0 h-[44%] w-full object-contain object-bottom sm:left-auto sm:right-0 sm:h-full sm:w-[55%] sm:object-right sm:p-5 lg:w-[58%] lg:p-7"
                          />

                          {/* Mobile image fade */}
                          <div className="absolute inset-x-0 bottom-0 h-[48%] bg-gradient-to-t from-[#172337]/20 via-[#172337]/50 to-transparent sm:hidden" />

                          {/* Desktop overlay */}
                          <div className="absolute inset-0 hidden bg-gradient-to-r from-[#172337]/95 via-[#172337]/65 to-transparent sm:block" />

                          {/* Content */}
                          <div className="relative z-10 flex h-full flex-col px-6 pt-12 text-white sm:max-w-2xl sm:justify-center sm:px-10 sm:py-10 sm:pt-10 lg:px-14">
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#FFE500] sm:text-xs">
                              <Sparkles size={14} />
                              {siteName} Deals
                            </div>

                            <div className="mt-3 inline-flex w-fit rounded-md bg-[#FFE500] px-3 py-1.5 text-xs font-bold text-[#172337] sm:mt-4">
                              {getDiscountLabel(slide.discount, slide.product)}
                            </div>

                            <h2 className="mt-3 max-w-[280px] text-[28px] font-bold leading-[1.05] sm:mt-4 sm:max-w-xl sm:text-4xl sm:leading-tight lg:text-5xl">
                              {slide.product.name}
                            </h2>

                            <p className="mt-3 max-w-[310px] text-[13px] leading-5 text-white/75 sm:max-w-lg sm:text-base sm:leading-6">
                              Grab this offer while it is available. Explore the
                              product and check out the current deal.
                            </p>

                            <div className="mt-4 sm:mt-5">
                              <span className="inline-flex items-center gap-2 rounded-md bg-[#FFE500] px-5 py-3 text-sm font-semibold text-[#172337] sm:px-6">
                                Shop now
                                <ArrowRight size={16} />
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>

              {dealSlides.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous deal"
                    onClick={previousSlide}
                    className="absolute bottom-[82px] left-3 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/95 text-[#172337] shadow-md transition hover:bg-white sm:bottom-auto sm:left-4 sm:top-1/2 sm:h-10 sm:w-10 sm:-translate-y-1/2"
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <button
                    type="button"
                    aria-label="Next deal"
                    onClick={nextSlide}
                    className="absolute bottom-[82px] right-3 z-20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/95 text-[#172337] shadow-md transition hover:bg-white sm:bottom-auto sm:right-4 sm:top-1/2 sm:h-10 sm:w-10 sm:-translate-y-1/2"
                  >
                    <ChevronRight size={20} />
                  </button>

                  <button
                    type="button"
                    aria-label={userPaused ? "Play slideshow" : "Pause slideshow"}
                    onClick={() => setUserPaused((current) => !current)}
                    className="absolute right-3 top-3 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/95 text-[#172337] shadow-md transition hover:bg-white sm:right-4 sm:top-4"
                  >
                    {userPaused ? <Play size={14} /> : <Pause size={14} />}
                  </button>

                  <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
                    {dealSlides.map((slide, index) => (
                      <button
                        key={slide.id}
                        type="button"
                        aria-label={`Go to deal ${index + 1}`}
                        onClick={() => setActiveSlide(index)}
                        className={`h-2 cursor-pointer rounded-full transition-all ${
                          index === currentSlide
                            ? "w-6 bg-[#FFE500]"
                            : "w-2 bg-white/60"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div
              className="relative min-h-[280px] bg-cover bg-center sm:min-h-[330px]"
              style={{
                backgroundImage: heroImageUrl
                  ? `linear-gradient(90deg, rgba(23,35,55,.94) 0%, rgba(23,35,55,.78) 42%, rgba(23,35,55,.25) 78%, rgba(23,35,55,.08) 100%), url("${heroImageUrl}")`
                  : "linear-gradient(135deg, #172337 0%, #2874F0 100%)",
              }}
            >
              <div className="relative flex min-h-[280px] max-w-2xl flex-col justify-center px-6 py-10 text-white sm:min-h-[330px] sm:px-10 lg:px-14">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#FFE500]">
                  <Sparkles size={14} />
                  {siteName} Store
                </div>

                <h1 className="mt-3 max-w-xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                  Everything you need. All in one place.
                </h1>

                <p className="mt-4 max-w-lg text-sm leading-6 text-white/75 sm:text-base">
                  Discover electronics, everyday essentials and selected products
                  at prices worth checking out.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    to="/shop"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-[#FFE500] px-6 py-3 text-sm font-semibold text-[#172337] transition hover:bg-[#F4D900]"
                  >
                    Shop now
                    <ArrowRight size={16} />
                  </Link>

                  <Link
                    to="/deals"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    View deals
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Trust strip */}
      <section className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-lg border border-[#E0E0E0] bg-white sm:grid-cols-3">
          <TrustItem
            icon={Heart}
            title="Carefully selected"
            text="Products worth discovering"
            className="border-b border-[#E0E0E0] sm:border-b-0 sm:border-r"
          />
          <TrustItem
            icon={Truck}
            title="Easy shopping"
            text="Simple and straightforward"
            className="border-b border-[#E0E0E0] sm:border-b-0 sm:border-r"
          />
          <TrustItem
            icon={ShieldCheck}
            title="Secure checkout"
            text="Shop with confidence"
          />
        </div>
      </section>

      {/* Top deals */}
      <SectionCard
        title="Top Deals"
        subtitle="Highest discounts and lowest prices"
        linkTo="/deals"
      >
        {renderProductRow(topDeals, {
          title: "No products yet",
          text: "Products will appear here once they are available.",
          action: "Shop products",
          to: "/shop",
        })}
      </SectionCard>

      {/* Shop by category */}
      <SectionCard
        title="Shop by Category"
        subtitle="Find what you are looking for"
        linkTo="/categories"
      >
        {loading ? (
          <div className="p-6">
            <LoadingState />
          </div>
        ) : categoryItems.length ? (
          <div className="grid grid-cols-2 gap-px bg-[#E0E0E0] sm:grid-cols-4 lg:grid-cols-8">
            {categoryItems.map((category) => (
              <Link
                key={category.id}
                to={`/categories/${category.slug}`}
                className="group flex min-h-[145px] cursor-pointer flex-col items-center justify-center bg-white px-3 py-5 text-center transition hover:bg-[#F8FAFF]"
              >
                {category.image_url ? (
                  <img
                    src={category.image_url}
                    alt=""
                    className="h-20 w-20 rounded-full object-cover transition duration-200 group-hover:scale-105"
                  />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#F1F3F6] text-2xl font-semibold text-[#2874F0]">
                    {category.name?.charAt(0)?.toUpperCase()}
                  </span>
                )}

                <span className="mt-3 max-w-[120px] truncate text-xs font-medium text-[#212121] group-hover:text-[#2874F0]">
                  {category.name}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-6">
            <EmptyState
              title="Categories are coming soon"
              text="Browse the full collection in the meantime."
              action="Shop products"
              to="/shop"
            />
          </div>
        )}
      </SectionCard>

      {/* New arrivals */}
      <SectionCard
        title="New Arrivals"
        subtitle="Fresh products added to the store"
        linkTo="/shop"
      >
        {renderProductRow(newArrivals, {
          title: "No products yet",
          text: "Products will appear here once they are available.",
          action: "Explore the shop",
          to: "/shop",
        })}
      </SectionCard>

      {/* Promo banner */}
      <section className="mx-auto max-w-[1400px] px-4 pt-5 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-lg bg-[#172337] px-6 py-8 text-white sm:px-10 sm:py-10">
          <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -bottom-40 right-24 h-96 w-96 rounded-full border border-white/10" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FFE500]">
                {siteName}
              </p>

              <h2 className="mt-2 max-w-2xl text-2xl font-bold sm:text-3xl">
                Find something you'll actually want to use.
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
                Browse the complete collection and discover products selected
                for everyday shopping.
              </p>
            </div>

            <Link
              to="/shop"
              className="inline-flex w-fit shrink-0 cursor-pointer items-center gap-2 rounded-md bg-[#FFE500] px-6 py-3 text-sm font-semibold text-[#172337] transition hover:bg-[#F4D900]"
            >
              Explore shop
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Recommended */}
      <SectionCard
        title="Recommended For You"
        subtitle={
          recentlyViewed.length
            ? "Based on products you've viewed"
            : "Products you might like"
        }
        linkTo="/shop"
        className="py-5"
      >
        {renderProductRow(recommendedProducts, {
          title: "Nothing to recommend yet",
          text: "Browse a few products and we'll personalize this section for you.",
          action: "Shop products",
          to: "/shop",
        })}
      </SectionCard>

      {/* Stats */}
      <section className="mx-auto max-w-[1400px] px-4 pb-6 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-lg border border-[#E0E0E0] bg-white sm:grid-cols-2 lg:grid-cols-4">
          <StatItem
            value={statValue(products.length)}
            title="Products available"
            text="Explore the full collection"
            className="border-b border-[#E0E0E0] sm:border-r lg:border-b-0"
          />
          <StatItem
            value={statValue(categories.length)}
            title="Categories"
            text="Different ways to browse"
            valueClass="text-[#388E3C]"
            className="border-b border-[#E0E0E0] lg:border-b-0 lg:border-r"
          />
          <StatItem
            value={statValue(activeDeals.length)}
            title="Active deals"
            text="Limited-time offers"
            className="border-b border-[#E0E0E0] sm:border-b-0 sm:border-r"
          />
          <StatItem
            value="✓"
            title="Secure checkout"
            text="Simple and secure shopping"
          />
        </div>
      </section>
    </main>
  );
}

export default Home;