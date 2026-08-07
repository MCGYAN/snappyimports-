import { MetadataRoute } from 'next';
import { SEO } from '@/lib/seo';

/**
 * Allow search engines and major AI crawlers to read the public site.
 * Private areas stay disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = SEO.siteUrl;
  const privatePaths = [
    '/admin/',
    '/api/',
    '/checkout',
    '/cart',
    '/account/',
    '/auth/',
    '/pay/',
  ];

  const aiBots = [
    'GPTBot',
    'ChatGPT-User',
    'OAI-SearchBot',
    'ClaudeBot',
    'anthropic-ai',
    'PerplexityBot',
    'Google-Extended',
    'Applebot-Extended',
    'Bytespider',
    'CCBot',
    'meta-externalagent',
  ];

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/llms.txt', '/llms-full.txt', '/og/', '/sitemap.xml'],
        disallow: privatePaths,
      },
      ...aiBots.map((userAgent) => ({
        userAgent,
        allow: ['/', '/llms.txt', '/llms-full.txt', '/about', '/faqs', '/shop', '/exchange', '/contact'],
        disallow: privatePaths,
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
