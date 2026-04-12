import Link from 'next/link';
import { AlertTriangle, Home, ShoppingBag } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-gray-50">
      <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-red-100">
        <AlertTriangle className="w-12 h-12 text-red-500" />
      </div>
      <h1 className="text-4xl md:text-5xl font-extrabold text-[#002B5E] mb-4">404 - Area Restricted</h1>
      <p className="text-lg text-gray-500 mb-8 max-w-md font-medium">
        The security perimeter you're trying to access doesn't exist, has been moved, or is currently restricted.
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 bg-[#002B5E] hover:bg-amber-500 hover:text-[#002B5E] text-white px-8 py-3.5 rounded-xl font-bold transition-all shadow-md"
        >
          <Home className="w-5 h-5" /> Return to Base
        </Link>
        <Link
          href="/shop"
          className="flex items-center justify-center gap-2 border-2 border-gray-200 hover:border-amber-500 bg-white hover:bg-amber-50 text-[#002B5E] px-8 py-3.5 rounded-xl font-bold transition-all"
        >
          <ShoppingBag className="w-5 h-5" /> Browse Equipment
        </Link>
      </div>
    </div>
  );
}
