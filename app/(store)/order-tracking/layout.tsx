import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('order-tracking', {
  path: '/order-tracking',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
