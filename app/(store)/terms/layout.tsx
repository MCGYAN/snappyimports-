import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('terms', {
  path: '/terms',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
