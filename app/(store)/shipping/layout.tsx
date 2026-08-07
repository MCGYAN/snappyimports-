import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('shipping', {
  path: '/shipping',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
