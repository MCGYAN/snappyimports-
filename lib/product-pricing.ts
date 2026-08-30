/**
 * Product pricing from supplier RMB using the Ghana Buy RMB rate.
 * buy_rmb_rate = RMB per 1 GH¢ (same as exchange desk).
 */

export function roundGhsToNearestTen(ghs: number): number {
  if (!Number.isFinite(ghs)) return 0;
  return Math.round(ghs / 10) * 10;
}

/** Convert supplier RMB to customer GH¢, rounded to nearest 10. */
export function rmbToGhsPrice(rmb: number, buyRmbRate: number): number {
  const rmbAmount = Number(rmb);
  const rate = Number(buyRmbRate);
  if (!(rmbAmount > 0) || !(rate > 0)) return 0;
  return roundGhsToNearestTen(rmbAmount / rate);
}

function parsePositiveRmb(raw: unknown): number | null {
  const rmb = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(rmb) && rmb > 0 ? rmb : null;
}

export function parseProductBasePriceRmb(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  return parsePositiveRmb((metadata as Record<string, unknown>).base_price_rmb);
}

export function parseComparePriceRmb(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  return parsePositiveRmb((metadata as Record<string, unknown>).compare_at_price_rmb);
}

export function parseVariantBasePriceRmb(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  return parsePositiveRmb((metadata as Record<string, unknown>).base_price_rmb);
}

export function parseProductLastBuyRate(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).last_buy_rmb_rate;
  const rate = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function resolveVariantRmbPrice(
  variantMetadata: unknown,
  productMetadata: unknown,
  explicitRmb?: number | null,
): number | null {
  if (explicitRmb != null && explicitRmb > 0) return explicitRmb;
  return parseVariantBasePriceRmb(variantMetadata) ?? parseProductBasePriceRmb(productMetadata);
}

export function formatRmbAmount(rmb: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(rmb));
}

export function formatGhsAmount(ghs: number): string {
  return new Intl.NumberFormat('en-GH', { maximumFractionDigits: 0 }).format(Math.round(ghs));
}

export type ProductRepriceRow = {
  id: string;
  name: string;
  slug: string;
  base_price_rmb: number;
  current_price: number;
  new_price: number;
};

export type ProductVariantRepriceInput = {
  id: string;
  price: number | string;
  metadata?: unknown;
};

export type ProductRepriceInput = {
  id: string;
  name: string;
  slug: string;
  price: number | string;
  compare_at_price?: number | string | null;
  metadata?: unknown;
  product_variants?: ProductVariantRepriceInput[];
};

export function buildProductRepriceRow(
  product: ProductRepriceInput,
  buyRmbRate: number,
): ProductRepriceRow | null {
  const basePriceRmb = parseProductBasePriceRmb(product.metadata);
  if (basePriceRmb == null) return null;

  const currentPrice = Number(product.price) || 0;
  const newPrice = rmbToGhsPrice(basePriceRmb, buyRmbRate);
  if (newPrice <= 0) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    base_price_rmb: basePriceRmb,
    current_price: currentPrice,
    new_price: newPrice,
  };
}

export function productHasRepriceChanges(product: ProductRepriceInput, buyRmbRate: number): boolean {
  const row = buildProductRepriceRow(product, buyRmbRate);
  if (!row) return false;

  if (row.new_price !== row.current_price) return true;

  const compareRmb = parseComparePriceRmb(product.metadata);
  if (compareRmb != null) {
    const currentCompare = Number(product.compare_at_price) || 0;
    const newCompare = rmbToGhsPrice(compareRmb, buyRmbRate);
    if (newCompare > 0 && newCompare !== currentCompare) return true;
  }

  for (const variant of product.product_variants || []) {
    const variantRmb = resolveVariantRmbPrice(variant.metadata, product.metadata);
    if (variantRmb == null) continue;
    const currentVariantPrice = Number(variant.price) || 0;
    const newVariantPrice = rmbToGhsPrice(variantRmb, buyRmbRate);
    if (newVariantPrice > 0 && newVariantPrice !== currentVariantPrice) return true;
  }

  return false;
}

export function filterChangedRepriceRows(rows: ProductRepriceRow[]): ProductRepriceRow[] {
  return rows.filter((row) => row.new_price !== row.current_price);
}

export type AppliedProductReprice = {
  product_id: string;
  price: number;
  compare_at_price: number | null;
  variant_updates: { id: string; price: number; base_price_rmb: number }[];
};

export function buildAppliedProductReprice(
  product: ProductRepriceInput,
  buyRmbRate: number,
): AppliedProductReprice | null {
  const basePriceRmb = parseProductBasePriceRmb(product.metadata);
  if (basePriceRmb == null) return null;

  const price = rmbToGhsPrice(basePriceRmb, buyRmbRate);
  if (price <= 0) return null;

  const compareRmb = parseComparePriceRmb(product.metadata);
  const compare_at_price = compareRmb != null ? rmbToGhsPrice(compareRmb, buyRmbRate) || null : null;

  const variant_updates = (product.product_variants || [])
    .map((variant) => {
      const variantRmb = resolveVariantRmbPrice(variant.metadata, product.metadata);
      if (variantRmb == null) return null;
      const variantPrice = rmbToGhsPrice(variantRmb, buyRmbRate);
      if (variantPrice <= 0) return null;
      return { id: variant.id, price: variantPrice, base_price_rmb: variantRmb };
    })
    .filter((row): row is { id: string; price: number; base_price_rmb: number } => row != null);

  return {
    product_id: product.id,
    price,
    compare_at_price,
    variant_updates,
  };
}
