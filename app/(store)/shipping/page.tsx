import Link from 'next/link';

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="store-page-header py-16">
        <div className="store-container relative z-10 text-center">
          <p className="store-eyebrow mb-3">Delivery</p>
          <h1 className="font-heading text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Your order gets home safe
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/80">
            We move your import from China to Ghana. You always know where it is.
          </p>
        </div>
      </div>

      <div className="store-container store-section">
        <div className="mb-16 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="mb-6 text-3xl font-bold text-gray-900">What happens after you order</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-light">
                  <span className="font-bold text-brand-primary">1</span>
                </div>
                <div>
                  <h3 className="mb-2 font-bold text-gray-900">You pay and we confirm</h3>
                  <p className="leading-relaxed text-gray-600">
                    Pay by Mobile Money for smaller carts, or by invoice transfer for bigger ones.
                    When payment is confirmed, we start your import.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-light">
                  <span className="font-bold text-brand-primary">2</span>
                </div>
                <div>
                  <h3 className="mb-2 font-bold text-gray-900">We source and ship</h3>
                  <p className="leading-relaxed text-gray-600">
                    We buy from trusted suppliers in China and move your goods toward Ghana.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-light">
                  <span className="font-bold text-brand-primary">3</span>
                </div>
                <div>
                  <h3 className="mb-2 font-bold text-gray-900">You stay updated</h3>
                  <p className="leading-relaxed text-gray-600">
                    Sign in with the same email you used at checkout to see your order journey,
                    or use Find my order in the footer.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-light">
                  <span className="font-bold text-brand-primary">4</span>
                </div>
                <div>
                  <h3 className="mb-2 font-bold text-gray-900">It arrives in Ghana</h3>
                  <p className="leading-relaxed text-gray-600">
                    Your import clears and becomes ready for pickup or delivery. We handle the hard part.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="mb-6 text-3xl font-bold text-gray-900">Good to know</h2>
            <div className="space-y-6 rounded-2xl bg-gray-50 p-6">
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-bold text-gray-900">
                  <i className="ri-time-line text-brand-primary"></i>
                  Timelines vary
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  Import timing depends on the product and how it ships. We update your order as
                  it moves. Ask us if you need a clearer estimate before you pay.
                </p>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 font-bold text-gray-900">
                  <i className="ri-calendar-line text-brand-primary"></i>
                  Clearing in Ghana
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  Goods coming into Ghana are cleared before pickup or delivery. We keep you posted
                  when that stage starts.
                </p>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 font-bold text-gray-900">
                  <i className="ri-store-2-line text-brand-primary"></i>
                  Pickup or delivery
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  When your package is ready in Ghana, open Deliveries in your account and choose
                  pickup or delivery. We call to confirm the arrangement and any delivery cost.
                </p>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 font-bold text-gray-900">
                  <i className="ri-phone-line text-brand-primary"></i>
                  We contact you
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  Before final handoff we reach out. Keep your phone number up to date.
                </p>
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-2 font-bold text-gray-900">
                  <i className="ri-whatsapp-line text-brand-primary"></i>
                  Need help sooner?
                </h3>
                <p className="text-sm leading-relaxed text-gray-600">
                  Message us on WhatsApp or use the contact page. Share your order number if you have it.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-16 rounded-2xl border border-gray-200 bg-white p-8">
          <h2 className="mb-6 text-3xl font-bold text-gray-900">Never wonder where your order is</h2>
          <p className="mb-6 leading-relaxed text-gray-600">
            Your account shows the real import journey. Typical steps look like this:
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
                <i className="ri-checkbox-circle-line text-2xl text-brand-primary"></i>
              </div>
              <p className="font-medium text-gray-900">Payment confirmed</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <i className="ri-shopping-bag-3-line text-2xl text-amber-700"></i>
              </div>
              <p className="font-medium text-gray-900">Sourcing in China</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-100">
                <i className="ri-ship-line text-2xl text-sky-700"></i>
              </div>
              <p className="font-medium text-gray-900">On the way to Ghana</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <i className="ri-home-smile-line text-2xl text-emerald-700"></i>
              </div>
              <p className="font-medium text-gray-900">Ready or delivered</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-center">
            <Link
              href="/account"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-brand-primary px-8 py-4 font-medium text-white transition-colors hover:bg-[#0d2747]"
            >
              <i className="ri-user-line"></i>
              Open my orders
            </Link>
            <Link
              href="/order-tracking"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border-2 border-slate-200 bg-white px-8 py-4 font-medium text-brand-primary transition-colors hover:border-brand-accent"
            >
              Find my order
            </Link>
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-brand-primary to-[#050f1f] p-8 text-center text-white">
          <h2 className="mb-4 text-3xl font-bold">Questions about delivery?</h2>
          <p className="mb-6 leading-relaxed text-white/80">
            Ask about timing, pickup, or where your order stands.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-6 py-3 font-medium text-brand-primary transition-colors hover:bg-blue-50"
            >
              Contact Support
            </Link>
            <Link
              href="/faqs"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-brand-accent px-6 py-3 font-medium text-white transition-colors hover:bg-[#e85f12]"
            >
              View FAQs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
