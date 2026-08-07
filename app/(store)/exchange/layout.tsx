import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('exchange', {
  path: '/exchange',
  ogImage: '/og/buy-rmb.png',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
