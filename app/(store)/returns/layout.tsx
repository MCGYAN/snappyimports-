import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('returns', {
  path: '/returns',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
