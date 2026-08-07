import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('account', {
  path: '/account',
  noindex: true,
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
