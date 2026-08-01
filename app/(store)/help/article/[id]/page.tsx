'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { sanitizeHtml } from '@/lib/sanitize';

const articles: Record<string, any> = {
  '1': {
    id: 1,
    title: 'How do I track my order?',
    category: 'Orders',
    views: 1247,
    helpful: 234,
    updated: 'August 2026',
    content: `
      <h2>Track your import</h2>
      <p>Sign in with the same email you used at checkout. Open the order from your account to see the China to Ghana journey.</p>
      <p>If you do not have an account yet, use <a href="/order-tracking">Find my order</a> in the footer with your order number and email.</p>
      <h2>Typical steps</h2>
      <ul>
        <li><strong>Payment confirmed:</strong> Money received. We start sourcing.</li>
        <li><strong>Sourcing in China:</strong> Goods are being prepared.</li>
        <li><strong>On the way to Ghana:</strong> Shipment is moving.</li>
        <li><strong>Ready or delivered:</strong> Ready for pickup or delivery.</li>
      </ul>
      <p>Need help? <a href="/contact">Contact us</a> or message us on WhatsApp with your order number.</p>
    `,
  },
  '6': {
    id: 6,
    title: 'How do I return an item?',
    category: 'Support',
    views: 2341,
    helpful: 456,
    updated: 'August 2026',
    content: `
      <h2>Import issues</h2>
      <p>There is no self-serve returns portal. Import orders are handled case by case.</p>
      <h3>What to do</h3>
      <ol>
        <li>Have your order number ready.</li>
        <li>Take clear photos if something is damaged or wrong.</li>
        <li><a href="/contact">Contact us</a> or message WhatsApp. We will tell you the next step.</li>
      </ol>
    `,
  },
};

const relatedArticles = [
  { id: 1, title: 'How do I track my order?', category: 'Orders' },
  { id: 6, title: 'How do I return an item?', category: 'Support' },
];

export default function ArticlePage() {
  const params = useParams();
  const articleId = params.id as string;
  const article = articles[articleId] || articles['1'];

  const [wasHelpful, setWasHelpful] = useState<boolean | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleHelpful = (helpful: boolean) => {
    setWasHelpful(helpful);
    setShowFeedback(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-4xl px-4">
        <Link
          href="/help"
          className="mb-6 inline-flex items-center whitespace-nowrap font-semibold text-brand-primary"
        >
          <i className="ri-arrow-left-line mr-2"></i>
          Back to Help Center
        </Link>

        <div className="mb-6 rounded-xl bg-white p-8 shadow-sm">
          <div className="mb-6 border-b border-gray-200 pb-6">
            <div className="mb-4 flex items-center space-x-3">
              <span className="whitespace-nowrap rounded-full bg-brand-light px-3 py-1 text-sm font-semibold text-brand-primary">
                {article.category}
              </span>
              <span className="text-sm text-gray-500">Updated {article.updated}</span>
            </div>
            <h1 className="mb-4 text-3xl font-bold text-gray-900">{article.title}</h1>
          </div>

          <div
            className="prose max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.content) }}
          />
        </div>

        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <p className="mb-4 font-semibold text-gray-900">Was this helpful?</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleHelpful(true)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => handleHelpful(false)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold"
            >
              No
            </button>
          </div>
          {showFeedback ? (
            <p className="mt-3 text-sm text-gray-600">
              {wasHelpful ? 'Thanks for the feedback.' : 'Sorry. Contact us and we will help.'}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-gray-900">Related</h2>
          <ul className="space-y-2">
            {relatedArticles.map((a) => (
              <li key={a.id}>
                <Link href={`/help/article/${a.id}`} className="font-medium text-brand-primary hover:underline">
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
