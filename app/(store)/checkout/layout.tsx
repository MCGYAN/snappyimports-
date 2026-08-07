import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('account', {
  path: '/checkout',
  title: 'Checkout',
  description: 'Complete your Snappy Imports Global order securely.',
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
