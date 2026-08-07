import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('categories', {
  path: '/categories',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
