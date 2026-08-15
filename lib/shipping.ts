export const SHIPPING_GOODS_CLASSES = ['normal', 'sensitive', 'heavy', 'bulk', 'custom'] as const;
export type ShippingGoodsClass = (typeof SHIPPING_GOODS_CLASSES)[number];

export const SHIPPING_STATUS = [
  'received',
  'loaded',
  'in_transit',
  'arrived',
  'clearing',
  'ready',
  'delivered',
] as const;
export type ShippingPackageStatus = (typeof SHIPPING_STATUS)[number];

export const SHIPPING_CLASS_LABELS: Record<ShippingGoodsClass, string> = {
  normal: 'Normal goods',
  sensitive: 'Sensitive goods',
  heavy: 'Heavy goods',
  bulk: 'Bulk goods',
  custom: 'Custom rate',
};

export const SHIPPING_STATUS_LABELS: Record<ShippingPackageStatus, string> = {
  received: 'Received at warehouse',
  loaded: 'Loaded',
  in_transit: 'On the way to Ghana',
  arrived: 'Arrived in Ghana',
  clearing: 'Customs clearing',
  ready: 'Ready for pickup or delivery',
  delivered: 'Delivered',
};

export type ShippingRateBoard = {
  id: number;
  usd_to_ghs: number;
  normal_usd_per_cbm: number;
  sensitive_usd_per_cbm: number;
  heavy_usd_per_cbm: number;
  bulk_usd_per_cbm: number;
  default_transit_days: number;
  notes: string | null;
  updated_at?: string;
};

export function rateForClass(board: ShippingRateBoard, goodsClass: ShippingGoodsClass) {
  if (goodsClass === 'sensitive') return Number(board.sensitive_usd_per_cbm) || 0;
  if (goodsClass === 'heavy') return Number(board.heavy_usd_per_cbm) || 0;
  if (goodsClass === 'bulk') return Number(board.bulk_usd_per_cbm) || 0;
  return Number(board.normal_usd_per_cbm) || 0;
}

export function calculateCbm(lengthM: number, widthM: number, heightM: number, quantity = 1) {
  const value = lengthM * widthM * heightM * Math.max(1, quantity);
  return Number.isFinite(value) && value > 0 ? Number(value.toFixed(4)) : 0;
}

export function calculateShipping(cbm: number, usdPerCbm: number, usdToGhs?: number | null) {
  const shippingUsd = Number((Math.max(0, cbm) * Math.max(0, usdPerCbm)).toFixed(2));
  const shippingGhs =
    usdToGhs && usdToGhs > 0 ? Number((shippingUsd * usdToGhs).toFixed(2)) : null;
  return { shippingUsd, shippingGhs };
}

export function formatUsd(amount: number) {
  return `$${Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatGhs(amount: number) {
  return `GH¢${Number(amount || 0).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function daysUntil(value?: string | null, now = Date.now()) {
  if (!value) return null;
  const milliseconds = new Date(value).getTime() - now;
  return Math.max(0, Math.ceil(milliseconds / 86_400_000));
}

export function createShippingTrackingId() {
  const code = Array.from(
    { length: 10 },
    () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)],
  ).join('');
  return `SHP-${code}`;
}
