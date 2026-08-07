import { SEO } from '@/lib/seo';

/** Full JSON-LD graph for AI crawlers + Google (brand SEO, not CMS). */
export function buildSiteJsonLdGraph() {
  const siteUrl = SEO.siteUrl;
  const sameAs = Object.values(SEO.social).filter(Boolean);

  const organization: Record<string, unknown> = {
    '@type': ['Organization', 'OnlineStore'],
    '@id': `${siteUrl}/#organization`,
    name: SEO.brandName,
    alternateName: ['Snappy Imports', 'Snappy Import Ghana', 'Snappy Imports GH'],
    url: siteUrl,
    description: SEO.aiSummary.whatWeAre,
    slogan: SEO.tagline,
    logo: {
      '@type': 'ImageObject',
      url: SEO.logoUrl,
      caption: SEO.brandName,
    },
    image: [`${siteUrl}${SEO.ogImages.default}`, SEO.logoUrl],
    email: SEO.contact.email,
    telephone: SEO.contact.phone,
    areaServed: {
      '@type': 'Country',
      name: 'Ghana',
    },
    knowsAbout: [
      'China to Ghana importing',
      'Vehicle import Ghana',
      'Gadgets import Ghana',
      'Equipment import Ghana',
      'Buy RMB Ghana',
      'Tema port clearing',
      'China sourcing',
    ],
    brand: {
      '@type': 'Brand',
      name: SEO.brandName,
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        telephone: SEO.contact.phone,
        email: SEO.contact.email,
        areaServed: 'GH',
        availableLanguage: ['English'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'sales',
        telephone: SEO.contact.phone,
        areaServed: 'GH',
        availableLanguage: ['English'],
      },
    ],
  };

  if (sameAs.length) organization.sameAs = sameAs;

  const localBusiness: Record<string, unknown> = {
    '@type': 'LocalBusiness',
    '@id': `${siteUrl}/#localbusiness`,
    name: SEO.brandName,
    url: siteUrl,
    image: `${siteUrl}${SEO.ogImages.default}`,
    description: SEO.aiSummary.whatWeAre,
    telephone: SEO.contact.phone,
    email: SEO.contact.email,
    priceRange: '$$',
    currenciesAccepted: 'GHS',
    paymentAccepted: 'Mobile Money, Bank Transfer, Card',
    areaServed: {
      '@type': 'Country',
      name: 'Ghana',
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'GH',
      addressLocality: 'Ghana',
    },
    parentOrganization: { '@id': `${siteUrl}/#organization` },
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    url: siteUrl,
    name: SEO.brandName,
    description: SEO.defaultDescription,
    inLanguage: 'en-GH',
    publisher: { '@id': `${siteUrl}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/shop?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const services = [
    {
      '@type': 'Service',
      '@id': `${siteUrl}/#service-import`,
      name: 'China to Ghana product importing',
      serviceType: 'Import facilitation',
      provider: { '@id': `${siteUrl}/#organization` },
      areaServed: { '@type': 'Country', name: 'Ghana' },
      description:
        'Import cars, gadgets, appliances, and equipment from China to Ghana with clear pricing and shipment updates.',
      url: `${siteUrl}/shop`,
    },
    {
      '@type': 'Service',
      '@id': `${siteUrl}/#service-buy-rmb`,
      name: 'Buy RMB with Ghana Cedis',
      serviceType: 'Currency exchange for China payments',
      provider: { '@id': `${siteUrl}/#organization` },
      areaServed: { '@type': 'Country', name: 'Ghana' },
      description:
        'Pay Ghana Cedis and receive RMB for paying Chinese suppliers. Official buy rate, invoice, and payment instructions.',
      url: `${siteUrl}/exchange`,
    },
    {
      '@type': 'Service',
      '@id': `${siteUrl}/#service-tracking`,
      name: 'Import order tracking',
      serviceType: 'Order tracking',
      provider: { '@id': `${siteUrl}/#organization` },
      areaServed: { '@type': 'Country', name: 'Ghana' },
      description:
        'Track your import from payment and sourcing through shipping to Ghana, clearing, and delivery or pickup.',
      url: `${siteUrl}/order-tracking`,
    },
  ];

  return {
    '@context': 'https://schema.org',
    '@graph': [organization, localBusiness, website, ...services],
  };
}

export function buildFaqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.answer,
      },
    })),
  };
}
