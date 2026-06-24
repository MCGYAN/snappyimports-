import Link from 'next/link';

export default function ShippingPage() {
  const deliveryOptions = [
    {
      type: 'Sea freight',
      time: '3 to 6 weeks typical',
      cost: 'Quote',
      description: 'Best for big or heavy items. We handle the port and clearing.',
      icon: 'ri-ship-line'
    },
    {
      type: 'Air freight',
      time: '1 to 2 weeks typical',
      cost: 'Quote',
      description: 'Faster when you need it sooner. Good for smaller items.',
      icon: 'ri-plane-line'
    },
    {
      type: 'Pick up in Ghana',
      time: 'When ready',
      cost: 'FREE',
      description: 'Collect from us when your import clears. No extra delivery fee.',
      icon: 'ri-store-2-line'
    }
  ];

  const zones = [
    {
      zone: 'Zone 1 Metro',
      areas: 'Metro area 1',
      standard: '1-2 days',
      express: 'Next day'
    },
    {
      zone: 'Zone 2 Suburban',
      areas: 'Metro area 2',
      standard: '2-3 days',
      express: 'Next day'
    },
    {
      zone: 'Zone 3 Major Cities',
      areas: 'Major cities',
      standard: '3-4 days',
      express: '1-2 days'
    },
    {
      zone: 'Zone 4 Other Areas',
      areas: 'All other locations',
      standard: '4-5 days',
      express: 'Not available'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="store-page-header py-16">
        <div className="store-container relative z-10 text-center">
          <p className="store-eyebrow mb-3">Delivery</p>
          <h1 className="font-heading text-3xl font-bold text-white sm:text-4xl lg:text-5xl">Your order gets home safe</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/80">
            We move your import from China to Ghana. You always know where it is.
          </p>
        </div>
      </div>

      <div className="store-container store-section">
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">How your import travels</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {deliveryOptions.map((option, index) => (
              <div key={index} className="store-card-interactive p-8">
                <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                  <i className={`${option.icon} text-2xl text-brand-primary`}></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{option.type}</h3>
                <div className="text-brand-primary font-bold text-xl mb-2">{option.cost}</div>
                <div className="text-gray-600 font-medium mb-4">{option.time}</div>
                <p className="text-gray-600 leading-relaxed">{option.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="store-card border-brand-accent/20 bg-brand-light rounded-2xl p-8 mb-16 text-center">
          <div className="w-16 h-16 bg-brand-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="ri-gift-line text-3xl text-white"></i>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Know your full cost up front</h3>
          <p className="text-lg text-gray-600">
            We spell out product, freight, and fees before you pay. <span className="font-bold text-brand-primary">No surprise bills later.</span>
          </p>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">How long to Ghana</h2>
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Zone</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Areas Covered</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Standard</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-900">Express</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {zones.map((zone, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{zone.zone}</td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{zone.areas}</td>
                      <td className="px-6 py-4 text-gray-900">{zone.standard}</td>
                      <td className="px-6 py-4 text-gray-900">{zone.express}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">What happens after you order</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-brand-light rounded-full flex items-center justify-center">
                  <span className="font-bold text-brand-primary">1</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">We confirm your order</h3>
                  <p className="text-gray-600 leading-relaxed">
                    You get a clear quote and timeline. No guessing what happens next.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-brand-light rounded-full flex items-center justify-center">
                  <span className="font-bold text-brand-primary">2</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">We source and ship</h3>
                  <p className="text-gray-600 leading-relaxed">
                    We buy from trusted suppliers and move your goods from China.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-brand-light rounded-full flex items-center justify-center">
                  <span className="font-bold text-brand-primary">3</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">You stay updated</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Never wonder where your order is. We tell you at every step.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-brand-light rounded-full flex items-center justify-center">
                  <span className="font-bold text-brand-primary">4</span>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">It arrives home</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Your import clears at Tema and comes to you. We handle the hard part.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-6">Good to know</h2>
            <div className="bg-gray-50 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <i className="ri-time-line text-brand-primary"></i>
                  Timelines
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  Sea takes longer. Air is faster. We give you a real date, not a vague promise.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <i className="ri-calendar-line text-brand-primary"></i>
                  Clearing at port
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  We help you through Tema port and customs. You know what to expect.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <i className="ri-phone-line text-brand-primary"></i>
                  We call you
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  Before delivery, we reach out. Keep your phone number up to date.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <i className="ri-home-line text-brand-primary"></i>
                  Missed delivery
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  We try again or hold it for pickup. We do not leave you guessing.
                </p>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <i className="ri-secure-payment-line text-brand-primary"></i>
                  Your goods are protected
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  Imports are insured in transit. Report damage within 48 hours and we act fast.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">Never wonder where your order is</h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Check your status anytime. You see updates at every step:
          </p>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-checkbox-circle-line text-2xl text-brand-primary"></i>
              </div>
              <p className="font-medium text-gray-900">Order Confirmed</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-package-line text-2xl text-amber-700"></i>
              </div>
              <p className="font-medium text-gray-900">Processing</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-truck-line text-2xl text-purple-700"></i>
              </div>
              <p className="font-medium text-gray-900">Out for Delivery</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-gift-line text-2xl text-brand-primary"></i>
              </div>
              <p className="font-medium text-gray-900">Delivered</p>
            </div>
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/order-tracking"
              className="inline-flex items-center gap-2 bg-brand-primary text-white px-8 py-4 rounded-full font-medium hover:bg-[#0d2747] transition-colors whitespace-nowrap"
            >
              <i className="ri-map-pin-line"></i>
              Track Your Order
            </Link>
          </div>
        </div>

        <div className="bg-gradient-to-br from-brand-primary to-[#050f1f] rounded-2xl p-8 text-white text-center">
          <h2 className="text-3xl font-bold mb-4">Questions about delivery?</h2>
          <p className="text-white/80 mb-6 leading-relaxed">
            We are here to help. Ask about costs, timing, or where your order stands.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-white text-brand-primary px-6 py-3 rounded-full font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
              Contact Support
            </Link>
            <Link
              href="/faqs"
              className="inline-flex items-center gap-2 bg-brand-accent text-white px-6 py-3 rounded-full font-medium hover:bg-[#e85f12] transition-colors whitespace-nowrap"
            >
              View FAQs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
