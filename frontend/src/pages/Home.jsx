import { useContext, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";

import api from "../services/api";
import ProductCard from "../components/ProductCard";
import {
  EmptyState,
  LoadingState,
} from "../components/Storefront";
import { SiteBrandingContext } from "../context/site-branding-context";

const RECENTLY_VIEWED_KEY = "terralens_recently_viewed";
const MAX_RECENT_PRODUCTS = 12;
const PRODUCTS_TO_LOAD_IMAGES = 30;

function readRecentlyViewed() {
  try {
    const stored = window.localStorage.getItem(RECENTLY_VIEWED_KEY);

    if (!stored) return [];

    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(Number)
      .filter((id) => Number.isFinite(id));
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
  return (
    product.category_id ??
    product.category?.id ??
    product.categoryId ??
    null
  );
}

function getProductBrandId(product) {
  return (
    product.brand_id ??
    product.brand?.id ??
    product.brandId ??
    null
  );
}

function getProductBrandName(product) {
  if (typeof product.brand === "string") {
    return product.brand;
  }

  return (
    product.brand?.name ??
    product.brand_name ??
    ""
  );
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

function getDiscountPercentage(discount, product) {
  if (!discount || !product) return 0;

  const price = getProductPrice(product);

  if (price <= 0) return 0;

  if (discount.discount_type === "percentage") {
    return Math.max(0, Number(discount.value) || 0);
  }

  if (discount.discount_type === "fixed") {
    const fixedValue = Number(discount.value) || 0;

    return Math.max(
      0,
      Math.min(100, (fixedValue / price) * 100),
    );
  }

  return 0;
}

function getDiscountAmount(discount, product) {
  if (!discount || !product) return 0;

  const price = getProductPrice(product);

  if (price <= 0) return 0;

  if (discount.discount_type === "percentage") {
    return Math.min(
      price,
      price * ((Number(discount.value) || 0) / 100),
    );
  }

  if (discount.discount_type === "fixed") {
    return Math.min(
      price,
      Number(discount.value) || 0,
    );
  }

  return 0;
}

function getEffectiveDiscount(product, discounts) {
  const matchingDiscounts = discounts.filter((discount) => {
    if (discount.product_id) {
      return Number(discount.product_id) === Number(product.id);
    }

    return true;
  });

  if (!matchingDiscounts.length) {
    return null;
  }

  return matchingDiscounts.reduce((best, discount) => {
    if (!best) return discount;

    const bestAmount = getDiscountAmount(best, product);
    const currentAmount = getDiscountAmount(discount, product);

    return currentAmount > bestAmount ? discount : best;
  }, null);
}

function Home() {
  const { heroImageUrl } = useContext(SiteBrandingContext);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeDeals, setActiveDeals] = useState([]);
  const [images, setImages] = useState({});
  const [recentlyViewed, setRecentlyViewed] = useState(
    () => readRecentlyViewed(),
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const { siteName = "TerraLens" } = useContext(
    SiteBrandingContext,
  );

  useEffect(() => {
    let alive = true;

    Promise.all([
      api.get("/products/"),
      api.get("/categories/"),
      api.get("/discounts/"),
    ])
      .then(async ([productResponse, categoryResponse, discountResponse]) => {
        if (!alive) return;

        const productData = productResponse.data || [];
        const categoryData = categoryResponse.data || [];
        const discountData = discountResponse.data || [];

        setProducts(productData);
        setCategories(categoryData);

        const now = Date.now();

        const currentDeals = discountData.filter((deal) => {
          if (!deal.is_active) return false;

          const startsAt = new Date(deal.start_date).getTime();
          const endsAt = new Date(deal.end_date).getTime();

          return startsAt <= now && endsAt >= now;
        });

        setActiveDeals(currentDeals);

        const productsToLoad = productData.slice(
          0,
          PRODUCTS_TO_LOAD_IMAGES,
        );

        const imageResults = await Promise.all(
          productsToLoad.map(async (product) => {
            try {
              const response = await api.get(
                `/products/${product.id}/images`,
              );

              const productImages = response.data || [];

              const primaryImage =
                productImages.find((image) => image.is_primary) ||
                productImages[0];

              return [
                product.id,
                primaryImage?.image_url || null,
              ];
            } catch {
              return [product.id, null];
            }
          }),
        );

        if (!alive) return;

        setImages(
          Object.fromEntries(
            imageResults.filter(([, url]) => Boolean(url)),
          ),
        );
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

  const trackProductView = (product) => {
    const productId = Number(product.id);

    if (!Number.isFinite(productId)) return;

    setRecentlyViewed((current) => {
      const updated = [
        productId,
        ...current.filter((id) => Number(id) !== productId),
      ].slice(0, MAX_RECENT_PRODUCTS);

      saveRecentlyViewed(updated);

      return updated;
    });
  };

  const dealSlides = useMemo(() => {
    return activeDeals
      .filter((deal) => deal.product_id)
      .map((deal) => {
        const product = products.find(
          (item) => Number(item.id) === Number(deal.product_id),
        );

        if (!product) return null;

        const image = images[product.id];

        if (!image) return null;

        return {
          id: deal.id,
          product,
          image,
          discount: deal,
        };
      })
      .filter(Boolean)
      .slice(0, 5);
  }, [activeDeals, products, images]);

  const currentSlide =
    dealSlides.length > 0
      ? Math.min(activeSlide, dealSlides.length - 1)
      : 0;

  useEffect(() => {
    if (dealSlides.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveSlide((current) => {
        if (current >= dealSlides.length - 1) {
          return 0;
        }

        return current + 1;
      });
    }, 4500);

    return () => {
      window.clearInterval(timer);
    };
  }, [dealSlides.length]);

  const topDeals = useMemo(() => {
    if (!products.length) return [];

    const productsWithDiscounts = products
      .map((product) => {
        const discount = getEffectiveDiscount(
          product,
          activeDeals,
        );

        if (!discount) return null;

        const discountPercentage = getDiscountPercentage(
          discount,
          product,
        );

        const discountAmount = getDiscountAmount(
          discount,
          product,
        );

        return {
          product,
          discountPercentage,
          discountAmount,
        };
      })
      .filter(Boolean)
      .filter(
        ({ discountAmount }) => discountAmount > 0,
      )
      .sort((a, b) => {
        if (
          b.discountPercentage !==
          a.discountPercentage
        ) {
          return (
            b.discountPercentage -
            a.discountPercentage
          );
        }

        if (b.discountAmount !== a.discountAmount) {
          return b.discountAmount - a.discountAmount;
        }

        return (
          getProductPrice(a.product) -
          getProductPrice(b.product)
        );
      });

    const selected = productsWithDiscounts
      .slice(0, 5)
      .map(({ product }) => product);


    if (selected.length < 5) {
      const selectedIds = new Set(
        selected.map((product) => product.id),
      );

      const cheapestProducts = [...products]
        .filter(
          (product) =>
            !selectedIds.has(product.id),
        )
        .sort(
          (a, b) =>
            getProductPrice(a) -
            getProductPrice(b),
        );

      for (const product of cheapestProducts) {
        if (selected.length >= 5) break;

        selected.push(product);
      }
    }

    return selected.slice(0, 5);
  }, [products, activeDeals]);

  const newArrivals = useMemo(() => {
    return [...products]
      .sort((a, b) => {
        const dateDifference =
          getProductDate(b) -
          getProductDate(a);

        if (dateDifference !== 0) {
          return dateDifference;
        }

        return Number(b.id) - Number(a.id);
      })
      .slice(0, 5);
  }, [products]);

  const recommendedProducts = useMemo(() => {
    if (!products.length) return [];

    const viewedProducts = recentlyViewed
      .map((id) =>
        products.find(
          (product) =>
            Number(product.id) === Number(id),
        ),
      )
      .filter(Boolean);

    const viewedIds = new Set(
      recentlyViewed.map(Number),
    );

    const newArrivalIds = new Set(
      newArrivals.map((product) => Number(product.id)),
    );

    if (!viewedProducts.length) {
      const selected = [];
      const usedCategories = new Set();

      const candidates = [...products]
        .filter(
          (product) =>
            !newArrivalIds.has(Number(product.id)),
        )
        .sort((a, b) => {
          const stockDifference =
            Number(b.stock || 0) -
            Number(a.stock || 0);

          if (stockDifference !== 0) {
            return stockDifference;
          }

          return getProductPrice(a) - getProductPrice(b);
        });


      for (const product of candidates) {
        if (selected.length >= 5) break;

        const categoryId =
          getProductCategoryId(product);

        if (
          categoryId &&
          !usedCategories.has(categoryId)
        ) {
          selected.push(product);
          usedCategories.add(categoryId);
        }
      }

      for (const product of candidates) {
        if (selected.length >= 5) break;

        if (
          selected.some(
            (item) => item.id === product.id,
          )
        ) {
          continue;
        }

        selected.push(product);
      }

      return selected.slice(0, 5);
    }

    const scoredProducts = products
      .filter(
        (product) =>
          !viewedIds.has(Number(product.id)),
      )
      .map((product) => {
        const categoryId =
          getProductCategoryId(product);

        const brandId =
          getProductBrandId(product);

        const brandName =
          getProductBrandName(product)
            .trim()
            .toLowerCase();

        let score = 0;

        viewedProducts.forEach((viewedProduct) => {
          const viewedCategoryId =
            getProductCategoryId(viewedProduct);

          const viewedBrandId =
            getProductBrandId(viewedProduct);

          const viewedBrandName =
            getProductBrandName(viewedProduct)
              .trim()
              .toLowerCase();

          if (
            categoryId &&
            viewedCategoryId &&
            String(categoryId) ===
              String(viewedCategoryId)
          ) {
            score += 6;
          }

          if (
            brandId &&
            viewedBrandId &&
            String(brandId) ===
              String(viewedBrandId)
          ) {
            score += 4;
          }

          if (
            brandName &&
            viewedBrandName &&
            brandName === viewedBrandName
          ) {
            score += 3;
          }
        });

        if (Number(product.stock || 0) > 0) {
          score += 0.5;
        }

        return {
          product,
          score,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return (
          getProductDate(b.product) -
          getProductDate(a.product)
        );
      });

    const selected = scoredProducts
      .filter(({ score }) => score > 0)
      .slice(0, 5)
      .map(({ product }) => product);

    if (selected.length < 5) {
      const selectedIds = new Set(
        selected.map((product) => Number(product.id)),
      );

      const fallbackProducts = [...products]
        .filter(
          (product) =>
            !viewedIds.has(Number(product.id)) &&
            !selectedIds.has(Number(product.id)),
        )
        .sort((a, b) => {
          const dateDifference =
            getProductDate(b) -
            getProductDate(a);

          if (dateDifference !== 0) {
            return dateDifference;
          }

          return (
            getProductPrice(a) -
            getProductPrice(b)
          );
        });

      for (const product of fallbackProducts) {
        if (selected.length >= 5) break;

        selected.push(product);
      }
    }

    return selected.slice(0, 5);
  }, [
    products,
    recentlyViewed,
    newArrivals,
  ]);

  const categoryItems = useMemo(
    () => categories.slice(0, 8),
    [categories],
  );

  const previousSlide = () => {
    if (dealSlides.length <= 1) return;

    setActiveSlide((current) =>
      current === 0
        ? dealSlides.length - 1
        : current - 1,
    );
  };

  const nextSlide = () => {
    if (dealSlides.length <= 1) return;

    setActiveSlide((current) =>
      current >= dealSlides.length - 1
        ? 0
        : current + 1,
    );
  };

  const renderProductCard = (product) => (
    <div
      key={product.id}
      className="w-[230px] shrink-0 sm:w-[245px]"
      onClick={() => trackProductView(product)}
    >
      <ProductCard
        product={product}
        imageUrl={images[product.id]}
      />
    </div>
  );

  return (
    
    <main className="min-h-screen bg-[#F1F3F6]">

      <section className="border-b border-[#E0E0E0] bg-white">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 items-stretch py-2 scrollbar-hide sm:grid-cols-5 lg:grid-cols-9">
            <Link
              to="/categories"
              className="flex min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 text-center transition hover:bg-[#F5F5F5]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF2FF] text-sm font-bold text-[#2874F0]">
                All
              </span>

              <span className="text-xs font-medium text-[#212121]">
                Categories
              </span>
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
                    {category.name
                      ?.charAt(0)
                      ?.toUpperCase()}
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

      <section className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-lg bg-[#172337]">
          {dealSlides.length > 0 ? (
            <>
            <SEO
              title="Home"
              description={`Shop quality products at ${siteName}. Discover great deals, trusted products, secure checkout, and reliable delivery.`}
            />
              {dealSlides.map((slide, index) => {
                const discount = slide.discount;

                const discountText =
                  discount.discount_type === "percentage"
                    ? `${Number(discount.value)}% OFF`
                    : `₹${Number(
                        discount.value,
                      ).toLocaleString(
                        "en-IN",
                      )} OFF`;

                return (
                  <div
                    key={slide.id}
                    className={
                      index === currentSlide
                        ? "relative opacity-100 transition-opacity duration-700"
                        : "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700"
                    }
                  >
                    <Link
                        to={`/products/${slide.product.id}`}
                        onClick={() =>
                          trackProductView(slide.product)
                        }
                        className="block cursor-pointer"
                      >
                        <div
                          className="
                            relative
                            min-h-[450px]
                            overflow-hidden
                            bg-[#172337]
                            sm:min-h-[330px]
                          "
                        >
                          {/* Product image */}
                          <img
                            src={slide.image}
                            alt={slide.product.name}
                            className="
                              absolute
                              bottom-0
                              left-0
                              h-[44%]
                              w-full
                              object-contain
                              object-bottom
                              sm:left-auto
                              sm:right-0
                              sm:h-full
                              sm:w-[55%]
                              sm:p-5
                              sm:object-right
                              lg:w-[58%]
                              lg:p-7
                            "
                          />

                          {/* Mobile image fade */}
                          <div
                            className="
                              absolute
                              inset-x-0
                              bottom-0
                              h-[48%]
                              bg-gradient-to-t
                              from-[#172337]/20
                              via-[#172337]/50
                              to-transparent
                              sm:hidden
                            "
                          />

                          {/* Desktop overlay */}
                          <div
                            className="
                              absolute
                              inset-0
                              hidden
                              bg-gradient-to-r
                              from-[#172337]/95
                              via-[#172337]/65
                              to-transparent
                              sm:block
                            "
                          />

                          {/* Mobile content */}
                          <div
                            className="
                              relative
                              z-10
                              flex
                              min-h-[450px]
                              flex-col
                              px-6
                              pt-12
                              text-white
                              sm:hidden
                            "
                          >
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#FFE500]">
                              <Sparkles size={13} />
                              TerraLens Deals
                            </div>

                            <div className="mt-3 inline-flex w-fit rounded-md bg-[#FFE500] px-3 py-1.5 text-xs font-bold text-[#172337]">
                              {discountText}
                            </div>

                            <h2 className="mt-3 max-w-[280px] text-[28px] font-bold leading-[1.05]">
                              {slide.product.name}
                            </h2>

                            <p className="mt-3 max-w-[310px] text-[13px] leading-5 text-white/75">
                              Grab this offer while it is available. Explore the product and check out the current deal.
                            </p>

                            <div className="mt-4">
                              <span
                                className="
                                  inline-flex
                                  items-center
                                  gap-2
                                  rounded-md
                                  bg-[#FFE500]
                                  px-5
                                  py-3
                                  text-sm
                                  font-semibold
                                  text-[#172337]
                                "
                              >
                                Shop now
                                <ArrowRight size={16} />
                              </span>
                            </div>
                          </div>

                          {/* Desktop content */}
                          <div
                            className="
                              relative
                              z-10
                              hidden
                              min-h-[330px]
                              max-w-2xl
                              flex-col
                              justify-center
                              px-10
                              py-10
                              text-white
                              sm:flex
                              lg:px-14
                            "
                          >
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#FFE500]">
                              <Sparkles size={14} />
                              TerraLens Deals
                            </div>

                            <div className="mt-4 inline-flex w-fit rounded-md bg-[#FFE500] px-3 py-1.5 text-xs font-bold text-[#172337]">
                              {discountText}
                            </div>

                            <h2 className="mt-4 max-w-xl text-4xl font-bold leading-tight lg:text-5xl">
                              {slide.product.name}
                            </h2>

                            <p className="mt-3 max-w-lg text-base leading-6 text-white/75">
                              Grab this offer while it is available. Explore the product and check out the current deal.
                            </p>

                            <div className="mt-5">
                              <span
                                className="
                                  inline-flex
                                  items-center
                                  gap-2
                                  rounded-md
                                  bg-[#FFE500]
                                  px-6
                                  py-3
                                  text-sm
                                  font-semibold
                                  text-[#172337]
                                "
                              >
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

              {dealSlides.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous deal"
                    onClick={previousSlide}
                    className="
                      absolute
                      bottom-[82px]
                      left-3
                      z-20
                      flex
                      h-9
                      w-9
                      -translate-y-1/2
                      cursor-pointer
                      items-center
                      justify-center
                      rounded-full
                      bg-white/95
                      text-[#172337]
                      shadow-md
                      transition
                      hover:bg-white
                      sm:left-4
                      sm:top-1/2
                      sm:bottom-auto
                      sm:h-10
                      sm:w-10
                      sm:translate-y-[-50%]
                    ">
                    <ChevronLeft size={20} />
                  </button>

                  <button
                    type="button"
                    aria-label="Next deal"
                    onClick={nextSlide}
                    className="
                      absolute
                      bottom-[82px]
                      right-3
                      z-20
                      flex
                      h-9
                      w-9
                      -translate-y-1/2
                      cursor-pointer
                      items-center
                      justify-center
                      rounded-full
                      bg-white/95
                      text-[#172337]
                      shadow-md
                      transition
                      hover:bg-white
                      sm:right-4
                      sm:top-1/2
                      sm:bottom-auto
                      sm:h-10
                      sm:w-10
                      sm:translate-y-[-50%]
                    "
                  >
                    <ChevronRight size={20} />
                  </button>

                  <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
                    {dealSlides.map((slide, index) => (
                      <button
                        key={slide.id}
                        type="button"
                        aria-label={`Go to deal ${index + 1}`}
                        onClick={() =>
                          setActiveSlide(index)
                        }
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
                  TerraLens Store
                </div>

                <h1 className="mt-3 max-w-xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                  Everything you need. All in one place.
                </h1>

                <p className="mt-4 max-w-lg text-sm leading-6 text-white/75 sm:text-base">
                  Discover electronics, everyday essentials
                  and selected products at prices worth
                  checking out.
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

      <section className="mx-auto max-w-[1400px] px-4 pt-4 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-lg border border-[#E0E0E0] bg-white sm:grid-cols-3">
          <div className="flex items-center gap-3 border-b border-[#E0E0E0] px-5 py-4 sm:border-b-0 sm:border-r">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2874F0]">
              <Heart size={17} />
            </span>

            <div>
              <p className="text-sm font-semibold text-[#212121]">
                Carefully selected
              </p>

              <p className="mt-0.5 text-xs text-[#878787]">
                Products worth discovering
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 border-b border-[#E0E0E0] px-5 py-4 sm:border-b-0 sm:border-r">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2874F0]">
              <Truck size={17} />
            </span>

            <div>
              <p className="text-sm font-semibold text-[#212121]">
                Easy shopping
              </p>

              <p className="mt-0.5 text-xs text-[#878787]">
                Simple and straightforward
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2874F0]">
              <ShieldCheck size={17} />
            </span>

            <div>
              <p className="text-sm font-semibold text-[#212121]">
                Secure checkout
              </p>

              <p className="mt-0.5 text-xs text-[#878787]">
                Shop with confidence
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pt-5 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white">
          <div className="flex items-center justify-between border-b border-[#EEEEEE] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-[#212121]">
                Top Deals
              </h2>

              <p className="mt-0.5 text-xs text-[#878787]">
                Highest discounts and lowest prices
              </p>
            </div>

            <Link
              to="/deals"
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2874F0] hover:underline"
            >
              View all
              <ChevronRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="p-6">
              <LoadingState />
            </div>
          ) : error ? (
            <div className="p-6">
              <EmptyState
                title="Deals unavailable"
                text={error}
              />
            </div>
          ) : topDeals.length ? (
            <div className="flex gap-4 overflow-x-auto p-4 scrollbar-hide sm:p-5">
              {topDeals.map(renderProductCard)}
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                title="No products yet"
                text="Products will appear here once they are available."
                action="Shop products"
                to="/shop"
              />
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pt-5 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white">
          <div className="flex items-center justify-between border-b border-[#EEEEEE] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-[#212121]">
                Shop by Category
              </h2>

              <p className="mt-0.5 text-xs text-[#878787]">
                Find what you are looking for
              </p>
            </div>

            <Link
              to="/categories"
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2874F0] hover:underline"
            >
              View all
              <ChevronRight size={14} />
            </Link>
          </div>

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
                      {category.name
                        ?.charAt(0)
                        ?.toUpperCase()}
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
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pt-5 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white">
          <div className="flex items-center justify-between border-b border-[#EEEEEE] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-[#212121]">
                New Arrivals
              </h2>

              <p className="mt-0.5 text-xs text-[#878787]">
                Fresh products added to the store
              </p>
            </div>

            <Link
              to="/shop"
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2874F0] hover:underline"
            >
              View all
              <ChevronRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="p-6">
              <LoadingState />
            </div>
          ) : error ? (
            <div className="p-6">
              <EmptyState
                title="Products unavailable"
                text={error}
              />
            </div>
          ) : newArrivals.length ? (
            <div className="flex gap-4 overflow-x-auto p-4 scrollbar-hide sm:p-5">
              {newArrivals.map(renderProductCard)}
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                title="No products yet"
                text="Products will appear here once they are available."
                action="Explore the shop"
                to="/shop"
              />
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pt-5 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-lg bg-[#172337] px-6 py-8 text-white sm:px-10 sm:py-10">
          <div className="absolute -right-20 -top-32 h-80 w-80 rounded-full border border-white/10" />
          <div className="absolute -bottom-40 right-24 h-96 w-96 rounded-full border border-white/10" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FFE500]">
                TerraLens
              </p>

              <h2 className="mt-2 max-w-2xl text-2xl font-bold sm:text-3xl">
                Find something you'll actually want to use.
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-white/65">
                Browse the complete collection and discover
                products selected for everyday shopping.
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

      <section className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white">
          <div className="flex items-center justify-between border-b border-[#EEEEEE] px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-semibold text-[#212121]">
                Recommended For You
              </h2>

              <p className="mt-0.5 text-xs text-[#878787]">
                {recentlyViewed.length
                  ? "Based on products you've viewed"
                  : "Products you might like"}
              </p>
            </div>

            <Link
              to="/shop"
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#2874F0] hover:underline"
            >
              View all
              <ChevronRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="p-6">
              <LoadingState />
            </div>
          ) : recommendedProducts.length ? (
            <div className="flex gap-4 overflow-x-auto p-4 scrollbar-hide sm:p-5">
              {recommendedProducts.map(renderProductCard)}
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                title="Nothing to recommend yet"
                text="Browse a few products and we'll personalize this section for you."
                action="Shop products"
                to="/shop"
              />
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 pb-6 sm:px-6 lg:px-8">
        <div className="grid overflow-hidden rounded-lg border border-[#E0E0E0] bg-white sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-b border-[#E0E0E0] px-5 py-5 sm:border-r lg:border-b-0">
            <p className="text-2xl font-bold text-[#2874F0]">
              {products.length}
            </p>

            <p className="mt-1 text-sm font-medium text-[#212121]">
              Products available
            </p>

            <p className="mt-1 text-xs text-[#878787]">
              Explore the full collection
            </p>
          </div>

          <div className="border-b border-[#E0E0E0] px-5 py-5 lg:border-b-0 lg:border-r">
            <p className="text-2xl font-bold text-[#388E3C]">
              {categories.length}
            </p>

            <p className="mt-1 text-sm font-medium text-[#212121]">
              Categories
            </p>

            <p className="mt-1 text-xs text-[#878787]">
              Different ways to browse
            </p>
          </div>

          <div className="border-b border-[#E0E0E0] px-5 py-5 sm:border-r sm:border-b-0">
            <p className="text-2xl font-bold text-[#2874F0]">
              {activeDeals.length}
            </p>

            <p className="mt-1 text-sm font-medium text-[#212121]">
              Active deals
            </p>

            <p className="mt-1 text-xs text-[#878787]">
              Limited-time offers
            </p>
          </div>

          <div className="px-5 py-5">
            <p className="text-2xl font-bold text-[#2874F0]">
              ✓
            </p>

            <p className="mt-1 text-sm font-medium text-[#212121]">
              Secure checkout
            </p>

            <p className="mt-1 text-xs text-[#878787]">
              Simple and secure shopping
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;