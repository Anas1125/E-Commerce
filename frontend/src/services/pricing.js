import api from "./api";

const CACHE_MS = 30_000;
let cachedDiscounts = null;
let cacheExpiresAt = 0;
let inFlightRequest = null;

export function getActiveDiscounts() {
  if (cachedDiscounts && Date.now() < cacheExpiresAt) {
    return Promise.resolve(cachedDiscounts);
  }

  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = api
    .get("/discounts/active")
    .then(({ data }) => {
      cachedDiscounts = Array.isArray(data) ? data : [];
      cacheExpiresAt = Date.now() + CACHE_MS;
      return cachedDiscounts;
    })
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
}

export function getProductPriceDetails(product, discounts = []) {
  const originalPrice = Math.max(0, Number(product?.price) || 0);
  const productId = product?.id;
  const now = Date.now();
  let bestDiscount = null;
  let bestAmount = 0;

  for (const discount of discounts) {
    if (!discount?.is_active) continue;

    if (
      discount.product_id != null &&
      String(discount.product_id) !== String(productId)
    ) {
      continue;
    }

    const startsAt = discount.start_date ? Date.parse(discount.start_date) : 0;
    const endsAt = discount.end_date ? Date.parse(discount.end_date) : Number.POSITIVE_INFINITY;
    if (Number.isFinite(startsAt) && startsAt > now) continue;
    if (Number.isFinite(endsAt) && endsAt < now) continue;

    const value = Number(discount.value) || 0;
    let amount = 0;
    if (discount.discount_type === "percentage") {
      amount = (originalPrice * value) / 100;
    } else if (discount.discount_type === "fixed") {
      amount = value;
    }

    amount = Math.min(originalPrice, Math.max(0, amount));
    amount = Math.round((amount + Number.EPSILON) * 100) / 100;

    if (amount > bestAmount) {
      bestAmount = amount;
      bestDiscount = discount;
    }
  }

  const label = bestDiscount
    ? bestDiscount.discount_type === "percentage"
      ? `${Number(bestDiscount.value)}% OFF`
      : `₹${bestAmount.toLocaleString("en-IN")} OFF`
    : "";

  return {
    discount: bestDiscount,
    originalPrice,
    discountAmount: bestAmount,
    discountedPrice: Math.max(0, originalPrice - bestAmount),
    label,
  };
}
