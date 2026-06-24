/**
 * Storefront & admin logos — served from `public/images/`.
 */
export const SITE_LOGO_PATH = '/images/snappy-imports-global-logo.png' as const;
export const ADMIN_LOGO_ICON_PATH = '/images/admin-logo.png' as const;

/** Chart & UI accents — keep admin visuals on-brand */
export const BRAND_PRIMARY = '#0B1F3A';
export const BRAND_ACCENT = '#F26B1D';

export type AdminStatTone = 'primary' | 'accent';

export const ADMIN_STAT_ICON: Record<AdminStatTone, string> = {
  primary: 'bg-brand-primary/10 text-brand-primary',
  accent: 'bg-brand-accent/10 text-brand-accent',
};

export function absoluteSiteLogoUrl(siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, '');
  return `${base}${SITE_LOGO_PATH}`;
}
