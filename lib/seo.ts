/**
 * Central SEO config — site name, descriptions, and social defaults.
 * Override via NEXT_PUBLIC_APP_URL and NEXT_PUBLIC_SITE_NAME.
 */

import { SNAPPY_SEO_KEYWORDS } from './snappy-import';
import { absoluteSiteLogoUrl } from './brand';

/** Valid absolute URL for metadataBase / sitemap; avoids `new URL()` throwing when env omits `https://`. */
function resolveSiteUrl(raw: string | undefined): string {
  const fallback = 'https://example.com';
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProtocol);
    return u.origin;
  } catch {
    return fallback;
  }
}

const SITE_URL = resolveSiteUrl(process.env.NEXT_PUBLIC_APP_URL);
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Snappy Imports Global';
const SITE_NAME_FULL = SITE_NAME;
const TAGLINE = 'Importing is no longer stressful';
const TAGLINE_LONG =
  'We handle the hard part so you do not have to. Cars, gadgets, and equipment from China to Ghana.';

export const SEO = {
  siteUrl: SITE_URL,
  siteName: SITE_NAME,
  siteNameFull: SITE_NAME_FULL,
  tagline: TAGLINE,
  taglineLong: TAGLINE_LONG,

  defaultTitle: `${SITE_NAME} | Import without the stress`,
  defaultDescription:
    'Import cars, gadgets, and equipment from China to Ghana. We handle the hard part. You stay in the loop.',

  keywords: [...SNAPPY_SEO_KEYWORDS, SITE_NAME, 'Ghana imports', 'China import'],

  /** OG/Twitter default image path (absolute URL). Use /og or dynamic opengraph-image. */
  defaultOgImagePath: `${SITE_URL}/og/default.png`,
  /** Organization / JSON-LD logo (absolute URL). Override with CMS `site_logo` in UI only; keep this for schema. */
  logoUrl: absoluteSiteLogoUrl(SITE_URL),

  contact: {
    phone: '',
    whatsapp: '',
    email: 'contact@example.com',
  },

  social: {
    facebook: '',
    instagram: '',
    twitter: '',
  },

  /** Per-page meta (override in generateMetadata). */
  pages: {
    home: {
      title: `${SITE_NAME} | Import without the stress`,
      description:
        'Import from China to Ghana without guesswork. Trusted suppliers, clear costs, and updates you can count on.',
    },
    shop: {
      title: `Browse imports | ${SITE_NAME}`,
      description: `Find cars, gadgets, and equipment to import. Filter by category and price. ${SITE_NAME} keeps it simple.`,
    },
    categories: {
      title: `Shop by Category | ${SITE_NAME}`,
      description: `Browse import categories for China to Ghana. Vehicles, electronics, equipment, and more.`,
    },
    about: {
      title: `About Us | ${SITE_NAME}`,
      description: `${SITE_NAME} helps Ghanaian buyers import from China without stress, scams, or guesswork.`,
    },
    contact: {
      title: `Contact Us | ${SITE_NAME}`,
      description: `Talk to real people about quotes, orders, or import questions. WhatsApp, phone, or our contact form.`,
    },
    blog: {
      title: `Blog | ${SITE_NAME}`,
      description: 'Tips and updates to help your next import go smoothly.',
    },
    faqs: {
      title: `FAQs | ${SITE_NAME}`,
      description: 'Quick answers about orders, shipping, payments, and returns.',
    },
    privacy: {
      title: `Privacy Policy | ${SITE_NAME}`,
      description: `How ${SITE_NAME} collects, uses, and protects your personal information.`,
    },
    terms: {
      title: `Terms of Service | ${SITE_NAME}`,
      description: `Terms and conditions for using ${SITE_NAME} and our services.`,
    },
    shipping: {
      title: `Shipping and delivery | ${SITE_NAME}`,
      description: 'Your import gets home safe. We move it from China to Ghana and keep you updated.',
    },
    cart: {
      title: `Cart | ${SITE_NAME}`,
      description: 'Your shopping cart.',
    },
    wishlist: {
      title: `Wishlist | ${SITE_NAME}`,
      description: 'Your saved products.',
    },
    account: {
      title: `My Account | ${SITE_NAME}`,
      description: 'Manage your account, orders, and profile.',
    },
  } as Record<string, { title: string; description: string }>,
};

export type SEOConfig = typeof SEO;
