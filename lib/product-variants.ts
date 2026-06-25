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
