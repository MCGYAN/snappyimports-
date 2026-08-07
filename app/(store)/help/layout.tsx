import { pageMetadata } from '@/lib/page-metadata';

export const metadata = pageMetadata('help', {
  path: '/help',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
