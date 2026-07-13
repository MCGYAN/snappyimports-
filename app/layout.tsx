import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Poppins } from "next/font/google";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { SEO } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

const poppins = Poppins({
  subsets: ["latin"],
  // Fewer weights = smaller font download on first visit
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
  preload: true,
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0B1F3A',
};

const siteUrl = SEO.siteUrl;

// Site-wide SEO defaults from lib/seo.ts. OG/twitter images: app/opengraph-image.tsx & twitter-image.tsx
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: SEO.defaultTitle,
    template: `%s | ${SEO.siteName}`,
  },
  description: SEO.defaultDescription,
  keywords: SEO.keywords,
  authors: [{ name: SEO.siteName }],
  creator: SEO.siteName,
  publisher: SEO.siteName,
  applicationName: SEO.siteName,
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [{ url: '/icon', type: 'image/png' }],
    apple: [{ url: '/favicon/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: SEO.siteName,
  },
  formatDetection: {
    telephone: true,
    email: false,
    address: false,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
  },
  openGraph: {
    type: "website",
    locale: "en",
    url: siteUrl,
    title: SEO.defaultTitle,
    description: SEO.defaultDescription,
    siteName: SEO.siteName,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: SEO.taglineLong }],
  },
  twitter: {
    card: "summary_large_image",
    title: SEO.defaultTitle,
    description: SEO.defaultDescription,
    images: ['/opengraph-image'],
    creator: SEO.social.twitter || undefined,
  },
  alternates: {
    canonical: siteUrl,
  },
  category: "shopping",
};

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const organizationNode: Record<string, unknown> = {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: SEO.siteName,
    url: siteUrl,
    description: SEO.defaultDescription,
    areaServed: "Worldwide",
    knowsAbout: ["E-commerce", "Online retail"],
  };
  if (SEO.logoUrl) {
    organizationNode.logo = { "@type": "ImageObject", url: SEO.logoUrl };
  }
  if (SEO.contact.phone) organizationNode.telephone = SEO.contact.phone;
  if (SEO.contact.email) organizationNode.email = SEO.contact.email;
  const sameAs = Object.values(SEO.social).filter(Boolean);
  if (sameAs.length) organizationNode.sameAs = sameAs;
  if (SEO.contact.phone) {
    organizationNode.contactPoint = {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: SEO.contact.phone,
      areaServed: "Worldwide",
      availableLanguage: "English",
    };
  }

  const websiteNode = {
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: SEO.siteName,
    description: SEO.defaultDescription,
    publisher: { "@id": `${siteUrl}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/shop?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0B1F3A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={SEO.siteName} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#0B1F3A" />
        <meta name="msapplication-tap-highlight" content="no" />

        <link rel="icon" href="/icon" type="image/png" sizes="any" />
        <link rel="dns-prefetch" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        {/* Non-blocking RemixIcon: load as print, then switch to all */}
        <link
          id="remixicon-css"
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css"
          media="print"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var l=document.getElementById('remixicon-css');if(!l)return;l.onload=function(){l.media='all'};if(l.sheet)l.media='all';setTimeout(function(){l.media='all'},3000);})();`,
          }}
        />
        <noscript>
          <link
            href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css"
            rel="stylesheet"
          />
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [organizationNode, websiteNode],
            }),
          }}
        />
      </head>

      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="lazyOnload"
          />
          <Script id="google-analytics" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}

      {RECAPTCHA_SITE_KEY && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="lazyOnload"
        />
      )}

      <body className="antialiased font-sans overflow-x-hidden pwa-body bg-brand-surface text-brand-foreground [scrollbar-gutter:stable]" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:px-6 focus:py-3 focus:bg-brand-primary focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg"
        >
          Skip to main content
        </a>
        <CartProvider>
          <WishlistProvider>
            <div id="main-content">
              {children}
            </div>
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
