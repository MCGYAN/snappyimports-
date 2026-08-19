/**
 * Product variant helpers — color × size selection on the storefront.
 */

export interface StoreVariant {
  id?: string;
  name?: string;
  option1?: string | null;
  option2?: string | null;
  color?: string;
  price?: number;
  quantity?: number;
  stock?: number;
}

export function getVariantColor(variant: StoreVariant): string {
  return (variant.option2 || variant.color || '').trim();
}

export function getVariantStock(variant: StoreVariant): number {
  const raw = variant.stock ?? variant.quantity ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Stable key for color × size (or color-only / size-only). */
export function variantOptionKey(variant: StoreVariant): string {
  const color = getVariantColor(variant).toLowerCase();
  const size = getVariantSizeLabel(variant).toLowerCase();
  return `${color}|${size}`;
}

/**
 * Collapse duplicate variant rows (same color/size) keeping the best stock row.
 * Fixes stale zero-qty duplicates left from partial saves.
 */
export function dedupeStoreVariants(variants: StoreVariant[]): StoreVariant[] {
  const map = new Map<string, StoreVariant>();

  for (const variant of variants) {
    const key = variantOptionKey(variant);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, variant);
      continue;
    }

    const stock = getVariantStock(variant);
    const existingStock = getVariantStock(existing);
    if (stock > existingStock) {
      map.set(key, variant);
      continue;
    }
    if (stock === existingStock && variant.id && existing.id && variant.id > existing.id) {
      map.set(key, variant);
    }
  }

  return [...map.values()];
}

/** Pick the in-stock variant row for a color (color-only or first size match). */
export function pickVariantForColor(variants: StoreVariant[], selectedColor: string): StoreVariant | null {
  const matching = dedupeStoreVariants(variantsForColor(variants, selectedColor));
  if (!matching.length) return null;

  if (isColorOnlyCatalog(matching)) {
    return matching.reduce((best, variant) =>
      getVariantStock(variant) > getVariantStock(best) ? variant : best,
    );
  }

  if (matching.length === 1) return matching[0];

  const colorOnly = matching.find(
    (variant) => inferVariantSizeName(getVariantColor(variant), variant.name || variant.option1 || '') === '',
  );
  if (colorOnly) return colorOnly;

  return matching.reduce((best, variant) =>
    getVariantStock(variant) > getVariantStock(best) ? variant : best,
  );
}

export function sumVariantStock(variants: StoreVariant[]): number {
  return dedupeStoreVariants(variants).reduce((sum, variant) => sum + getVariantStock(variant), 0);
}

export function inferVariantSizeName(color: string, variantName: string): string {
  const c = color.trim().toLowerCase();
  const n = variantName.trim();
  if (!n) return '';
  if (c && n.toLowerCase() === c) return '';
  return n;
}

export function getVariantSizeLabel(variant: StoreVariant): string {
  const color = getVariantColor(variant);
  const raw = (variant.name || variant.option1 || '').trim();
  const size = inferVariantSizeName(color, raw);
  return size || raw;
}

/** Unique color options for the color picker. */
export function getProductColorOptions(variants: StoreVariant[]): string[] {
  const colors = new Set<string>();
  for (const variant of variants) {
    const color = getVariantColor(variant);
    if (color) {
      colors.add(color);
      continue;
    }
    const name = getVariantSizeLabel(variant);
    if (name) colors.add(name);
  }
  return [...colors];
}

/** Variants matching a selected color (case-insensitive). */
export function variantsForColor(variants: StoreVariant[], selectedColor: string): StoreVariant[] {
  if (!selectedColor.trim()) return [];
  const key = selectedColor.trim().toLowerCase();
  return variants.filter((variant) => {
    const color = getVariantColor(variant).toLowerCase();
    if (color) return color === key;
    return getVariantSizeLabel(variant).toLowerCase() === key;
  });
}

/** True when each variant is identified by color only (no separate size/type). */
export function isColorOnlyCatalog(variants: StoreVariant[]): boolean {
  if (!variants.length) return false;
  return variants.every((variant) => {
    const color = getVariantColor(variant);
    const raw = (variant.name || variant.option1 || '').trim();
    if (!color) return false;
    return inferVariantSizeName(color, raw) === '';
  });
}

/** Distinct size/type labels for the selected color (excludes color-only names). */
export function getSizeOptionsForColor(
  variants: StoreVariant[],
  selectedColor: string,
  allColorOptions: string[] = [],
): string[] {
  const scoped = variantsForColor(variants, selectedColor);
  const colorKey = selectedColor.trim().toLowerCase();
  const otherColorNames = new Set(
    allColorOptions.map((c) => c.trim().toLowerCase()).filter((c) => c && c !== colorKey),
  );
  const labels = new Set<string>();

  for (const variant of scoped) {
    const label = getVariantSizeLabel(variant);
    if (!label) continue;
    const labelKey = label.toLowerCase();
    if (labelKey === colorKey) continue;
    if (otherColorNames.has(labelKey)) continue;
    labels.add(label);
  }

  return [...labels];
}


export function findVariantByColorAndSize(
  variants: StoreVariant[],
  selectedColor: string,
  sizeLabel: string,
): StoreVariant | undefined {
  const scoped = variantsForColor(variants, selectedColor);
  if (!sizeLabel.trim()) {
    return scoped.length === 1 ? scoped[0] : undefined;
  }
  const sizeKey = sizeLabel.trim().toLowerCase();
  return scoped.find((v) => getVariantSizeLabel(v).toLowerCase() === sizeKey);
}

/** Human-readable cart/invoice label. Avoids "Blue / Blue". */
export function formatVariantLabel(
  variant: StoreVariant | null | undefined,
  selectedColor?: string,
): string {
  if (!variant && !selectedColor) return '';
  const color = (variant ? getVariantColor(variant) : '') || (selectedColor || '').trim();
  const size = variant ? getVariantSizeLabel(variant) : '';
  const sizeClean = size && color && size.toLowerCase() === color.toLowerCase() ? '' : size;

  if (color && sizeClean) return `${color} / ${sizeClean}`;
  return color || sizeClean || (variant?.name || '').trim();
}

/** Normalize stored labels like "Blue / Blue" for display. */
export function cleanVariantDisplayLabel(label: string | null | undefined): string {
  if (!label) return '';
  const parts = label.split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) {
    return parts[0];
  }
  return label.trim();
}

