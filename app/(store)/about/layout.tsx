import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('about', {
  path: '/about',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
