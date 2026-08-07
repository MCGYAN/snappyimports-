import { pageMetadata } from '@/lib/page-metadata';
import { FAQ_ITEMS } from '@/lib/faq-content';
import { buildFaqJsonLd } from '@/lib/structured-data';

export const metadata = pageMetadata('faqs', {
  path: '/faqs',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  const faqLd = buildFaqJsonLd(FAQ_ITEMS);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      {children}
    </>
  );
}
