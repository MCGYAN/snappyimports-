import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('shop', {
  path: '/shop',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
