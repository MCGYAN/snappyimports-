import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('contact', {
  path: '/contact',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
