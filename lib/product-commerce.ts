/**
 * Per-product commerce & import settings (stored in products.metadata).
 * Extends existing category-based import behaviour — does not replace it.
 */

import type { ImportProductMode } from './snappy-import';

export type ImportTypeValue = 'cif_tema' | 'fob_china' | 'exw' | 'ddp' | 'custom' | '';

export const IMPORT_TYPE_OPTIONS: { value: ImportTypeValue; label: string }[] = [
  { value: 'cif_tema', label: 'CIF Tema' },
  { value: 'fob_china', label: 'FOB China' },
  { value: 'exw', label: 'EXW' },
  { value: 'ddp', label: 'DDP' },
  { value: 'custom', label: 'Custom' },
];

export const IMPORT_TYPE_DESCRIPTIONS: Record<string, string> = {
  cif_tema:
    'Cost, Insurance & Freight to Tema port. The listed price typically includes shipping to Ghana and insurance; local clearing and delivery may be extra.',
  fob_china:
    'Free On Board China. The price is for the goods at the origin port; shipping, insurance, and Ghana clearance are usually arranged separately.',
  exw:
    'Ex Works. You collect from the supplier location in China; all freight, insurance, and import handling to Ghana is on you or arranged with us.',
  ddp:
    'Delivered Duty Paid. The price aims to cover delivery to you in Ghana, including duties where quoted. Confirm scope with us before paying.',
  custom:
    'Custom import terms. See notes below or message us for exactly what is included in this price.',
};

export interface ProductCommerceSettings {
  /** null = use legacy category-based checkout rules */
  directPayment: boolean | null;
  importType: ImportTypeValue;
  importNotes: string;
}

export function parseProductCommerce(metadata?: Record<string, unknown> | null): ProductCommerceSettings {
  const raw = metadata?.direct_payment;
  let directPayment: boolean | null = null;
  if (raw === true || raw === 'true') directPayment = true;
  else if (raw === false || raw === 'false') directPayment = false;

  const importType = (metadata?.import_type as ImportTypeValue) || '';
  const importNotes = typeof metadata?.import_notes === 'string' ? metadata.import_notes.trim() : '';

  return { directPayment, importType, importNotes };
}

/** Respects explicit per-product setting; falls back to existing category heuristics. */
export function resolveDirectPayment(
  directPayment: boolean | null,
  importMode: ImportProductMode,
): boolean {
  if (directPayment === true) return true;
  if (directPayment === false) return false;
  return importMode === 'gadgets' || importMode === 'default';
}

export function getProductShareUrl(slug: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/product/${slug}`;
}

export function getImportTypeLabel(value: string): string {
  return IMPORT_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;
}

export function buildProductInquiryWhatsAppText(productName: string, shareUrl: string): string {
  return `Hi, I'm interested in: ${productName}\n${shareUrl}`;
}

export function buildAvailabilityWhatsAppText(productName: string, shareUrl: string): string {
  return `Hi, I'd like to check availability for: ${productName}\n${shareUrl}`;
}
