import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('blog', {
  path: '/blog',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
