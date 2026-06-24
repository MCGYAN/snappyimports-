import Link from 'next/link';
import { AlertTriangle, Home, ShoppingBag } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-brand-light">
      <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-red-100">
        <AlertTriangle className="w-12 h-12 text-red-500" />
      </div>
      <h1 className="text-4xl md:text-5xl font-extrabold text-brand-primary mb-4">Page not found</h1>
      <p className="text-lg text-brand-foreground/70 mb-8 max-w-md font-medium">
        That link is not in our import catalogue; it may have moved. Head home or browse featured products to keep your order on track.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/"
          className="btn-primary flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-8 py-3.5 font-bold text-white hover:bg-brand-accent"
        >
          <Home className="w-5 h-5" /> Back to home
        </Link>
        <Link
          href="/shop"
          className="btn-secondary flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 bg-brand-surface px-8 py-3.5 font-bold text-brand-primary hover:border-brand-accent hover:bg-brand-light"
        >
          <ShoppingBag className="w-5 h-5" /> Browse featured products
        </Link>
      </div>
    </div>
  );
}
