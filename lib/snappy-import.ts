/**
 * Snappy Import Ghana — storefront helpers (UI only).
 * Maps product categories to hybrid import behaviour: vehicles / gadgets / equipment.
 */

export type ImportProductMode = 'vehicles' | 'gadgets' | 'equipment' | 'default';

const VEHICLE_KEYS = /vehicle|car|auto|truck|suv|van|motor/i;
const GADGET_KEYS = /gadget|electronic|phone|laptop|tablet|camera|audio|appliance|tv|home\s*tech/i;
const EQUIPMENT_KEYS = /equipment|machinery|industrial|tool|heavy|generator|compressor|forklift/i;

export function getImportProductMode(categoryName?: string | null, categorySlug?: string | null): ImportProductMode {
  const hay = `${categoryName || ''} ${categorySlug || ''}`.toLowerCase();
  if (VEHICLE_KEYS.test(hay)) return 'vehicles';
  if (EQUIPMENT_KEYS.test(hay)) return 'equipment';
  if (GADGET_KEYS.test(hay)) return 'gadgets';
  return 'default';
}

export function getDefaultPhoneCountryCode(): string {
  return (process.env.NEXT_PUBLIC_DEFAULT_PHONE_COUNTRY_CODE || '233').replace(/\D/g, '') || '233';
}

/** Store defaults when CMS / env contact fields are unset. */
export const DEFAULT_CONTACT_PHONE = '0593610190';
export const DEFAULT_CONTACT_WHATSAPP = '0593517270';

export function resolveContactPhone(cmsValue?: string | null): string {
  return (
    cmsValue?.trim() ||
    process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() ||
    DEFAULT_CONTACT_PHONE
  );
}

export function resolveContactWhatsApp(cmsValue?: string | null): string {
  return (
    cmsValue?.trim() ||
    process.env.NEXT_PUBLIC_CONTACT_WHATSAPP?.trim() ||
    process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim() ||
    DEFAULT_CONTACT_WHATSAPP
  );
}

/** Build WhatsApp link from raw number in CMS (supports local leading 0). */
export function buildWhatsAppHref(raw: string | undefined | null): string {
  if (!raw?.trim()) return '';
  const cc = getDefaultPhoneCountryCode();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const intl = digits.startsWith('0') ? `${cc}${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}`;
}

export function buildTelHref(raw: string | undefined | null): string {
  if (!raw?.trim()) return '';
  const cc = getDefaultPhoneCountryCode();
  const t = raw.replace(/\s/g, '');
  if (t.startsWith('+')) return `tel:${t}`;
  if (t.startsWith('0')) return `tel:+${cc}${t.slice(1)}`;
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 10) return `tel:+${digits}`;
  return `tel:${t}`;
}

export const SNAPPY_SEO_KEYWORDS = [
  'Snappy Import Ghana',
  'import cars from China Ghana',
  'buy gadgets from China Ghana',
  'affordable imports Ghana',
  'China to Ghana shipping',
  'Tema port clearing',
  'import equipment Ghana',
];
