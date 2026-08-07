import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('cart', {
  path: '/cart',
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
