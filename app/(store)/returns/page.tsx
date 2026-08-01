import Link from 'next/link';
import {
  buildWhatsAppHref,
  resolveContactWhatsApp,
} from '@/lib/snappy-import';

export default function ReturnsPage() {
  const waHref = buildWhatsAppHref(resolveContactWhatsApp(null));

  return (
    <div className="min-h-screen bg-white">
      <div className="store-page-header py-16">
        <div className="store-container relative z-10 text-center">
          <p className="store-eyebrow mb-3">Support</p>
          <h1 className="font-heading text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Returns and issues
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/80">
            Import orders are handled case by case. Message us and we will tell you the next step.
          </p>
        </div>
      </div>

      <div className="store-container store-section">
        <div className="mx-auto max-w-2xl space-y-8">
          <div className="store-card space-y-4 p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900">How to get help</h2>
            <ol className="list-decimal space-y-3 pl-5 text-gray-600">
              <li>Have your order number ready if you have it.</li>
              <li>Send clear photos if something is damaged or wrong.</li>
              <li>Contact us on WhatsApp or the contact page. We review it with you.</li>
            </ol>
            <p className="text-sm text-gray-500">
              There is no self-serve returns portal. We handle each import personally.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-8 py-4 font-bold text-white"
              >
                <i className="ri-whatsapp-line text-xl"></i>
                Message on WhatsApp
              </a>
            ) : null}
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-primary px-8 py-4 font-bold text-white hover:bg-[#0d2747]"
            >
              Contact us
            </Link>
            <Link
              href="/account"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-slate-200 bg-white px-8 py-4 font-semibold text-brand-primary"
            >
              Open my orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
