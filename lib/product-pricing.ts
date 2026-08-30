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

export function parseProductBasePriceRmb(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).base_price_rmb;
  const rmb = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(rmb) && rmb > 0 ? rmb : null;
}

export function parseProductLastBuyRate(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).last_buy_rmb_rate;
  const rate = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
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

export function buildProductRepriceRow(
  product: { id: string; name: string; slug: string; price: number | string; metadata?: unknown },
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

export function filterChangedRepriceRows(rows: ProductRepriceRow[]): ProductRepriceRow[] {
  return rows.filter((row) => row.new_price !== row.current_price);
}
