export default function MaintenancePage() {
  return (
    <div className="min-h-screen store-page-header flex items-center justify-center px-4">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <div className="w-32 h-32 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-tools-line text-6xl text-brand-primary"></i>
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            We will be right back
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            We are making the site better for you. It will not take long.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Back soon</h2>
          <div className="flex items-center justify-center gap-3 text-brand-primary">
            <i className="ri-time-line text-3xl"></i>
            <div className="text-left">
              <p className="text-sm text-gray-600">About</p>
              <p className="text-2xl font-bold">30 minutes</p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-rocket-line text-2xl text-brand-primary"></i>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Faster site</h3>
            <p className="text-gray-600 text-sm">Pages load quicker. Less waiting for you.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-shield-check-line text-2xl text-brand-primary"></i>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Safer checkout</h3>
            <p className="text-gray-600 text-sm">Stronger protection for your orders and account.</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-sparkle-line text-2xl text-amber-700"></i>
            </div>
            <h3 className="font-bold text-gray-900 mb-2">Easier to use</h3>
            <p className="text-gray-600 text-sm">A smoother experience when you come back.</p>
          </div>
        </div>

        <div className="border border-brand-accent/20 bg-brand-light rounded-2xl p-8 mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Need help now?</h3>
          <p className="text-gray-600 mb-6">
            We are still here for you while the site is down.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href="mailto:contact@example.com"
              className="inline-flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-full font-medium hover:bg-[#0d2747] transition-colors whitespace-nowrap"
            >
              <i className="ri-mail-line"></i>
              Email us
            </a>
            <a
              href="tel:"
              className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-900 px-6 py-3 rounded-full font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <i className="ri-phone-line"></i>
              Call us
            </a>
          </div>
        </div>

        <p className="text-gray-500 text-sm">
          Thank you for your patience. We will be back shortly.
        </p>
      </div>
    </div>
  );
}
