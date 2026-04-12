/**
 * Central SEO config for Sambatek — overrides CMS. Single source of truth for
 * site name, descriptions, keywords, and social defaults.
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.sambatekgh.com';
const SITE_NAME = 'SaMba TeK';
const SITE_NAME_FULL = 'SaMba TeK Security';
const TAGLINE = 'Advanced Security Solutions';
const TAGLINE_LONG = 'Durable security doors, modern CCTV surveillance, smart locks and access control systems in Ghana.';

export const SEO = {
  siteUrl: SITE_URL,
  siteName: SITE_NAME,
  siteNameFull: SITE_NAME_FULL,
  tagline: TAGLINE,
  taglineLong: TAGLINE_LONG,

  defaultTitle: `${SITE_NAME} | Security Doors, CCTV, Smart Locks & Access Control in Ghana`,
  defaultDescription:
    'SaMba TeK delivers advanced security solutions for homes, offices and commercial properties in Ghana — durable security doors, modern CCTV surveillance, smart locks and access control systems. Serving Accra, Tarkwa and across Ghana.',

  keywords: [
    'SaMba TeK',
    'Sambatek',
    'security doors Ghana',
    'security doors Accra',
    'security doors Tarkwa',
    'CCTV Ghana',
    'CCTV Accra',
    'CCTV Tarkwa',
    'surveillance systems Ghana',
    'smart locks Ghana',
    'access control Ghana',
    'access control systems Accra',
    'security solutions Ghana',
    'home security Ghana',
    'office security Ghana',
    'commercial security Ghana',
  ],

  /** OG/Twitter default image path (absolute URL). Use /og or dynamic opengraph-image. */
  defaultOgImagePath: `${SITE_URL}/og/default.png`,
  logoUrl: `${SITE_URL}/logo.png`,

  contact: {
    phone: '+233593610190',
    whatsapp: '0593517270',
    email: 'joelyrix52@gmail.com',
  },

  social: {
    facebook: '',
    instagram: '',
    twitter: '',
  },

  /** Per-page meta (override in generateMetadata). */
  pages: {
    home: {
      title: `${SITE_NAME} | Security Doors, CCTV, Smart Locks & Access Control in Ghana`,
      description: 'Protect your home, office and business with durable security doors, modern CCTV surveillance, smart locks and access control systems installed by professionals. Serving Accra, Tarkwa and across Ghana.',
    },
    shop: {
      title: `Shop All Products | ${SITE_NAME}`,
      description: 'Browse security doors, CCTV cameras, smart locks and access control systems. Fast delivery across Ghana.',
    },
    categories: {
      title: `Categories | ${SITE_NAME}`,
      description: 'Explore security product categories: security doors, CCTV & surveillance, smart locks and access control.',
    },
    about: {
      title: `About Us | ${SITE_NAME}`,
      description: 'SaMba TeK is a Ghanaian technology company specializing in advanced security solutions for homes, offices and commercial properties. Serving Accra, Tarkwa and across Ghana.',
    },
    contact: {
      title: `Contact Us | ${SITE_NAME}`,
      description: 'Get in touch with SaMba TeK for quotes, installations and support for security doors, CCTV, smart locks and access control. Phone, WhatsApp, and contact form.',
    },
    blog: {
      title: `Blog | ${SITE_NAME}`,
      description: 'Security tips, product guides, and industry insights from Sambatek.',
    },
    faqs: {
      title: `FAQs | ${SITE_NAME}`,
      description: 'Frequently asked questions about orders, shipping, returns, and our security products.',
    },
    privacy: {
      title: `Privacy Policy | ${SITE_NAME}`,
      description: 'How Sambatek collects, uses, and protects your personal information.',
    },
    terms: {
      title: `Terms of Service | ${SITE_NAME}`,
      description: 'Terms and conditions for using Sambatek Store and our services.',
    },
    shipping: {
      title: `Shipping & Delivery | ${SITE_NAME}`,
      description: 'Delivery options, areas we serve, and shipping information for Ghana.',
    },
    cart: {
      title: `Cart | ${SITE_NAME}`,
      description: 'Your shopping cart at Sambatek Store.',
    },
    wishlist: {
      title: `Wishlist | ${SITE_NAME}`,
      description: 'Your saved products at Sambatek Store.',
    },
    account: {
      title: `My Account | ${SITE_NAME}`,
      description: 'Manage your Sambatek account, orders, and profile.',
    },
  } as Record<string, { title: string; description: string }>,
};

export type SEOConfig = typeof SEO;
