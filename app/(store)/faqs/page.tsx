"use client";

import { useState } from 'react';
import Link from 'next/link';
import { FAQ_CATEGORIES, FAQ_ITEMS } from '@/lib/faq-content';

export default function FAQsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = FAQ_CATEGORIES;
  const faqs = FAQ_ITEMS;

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchesSearch = searchQuery === '' || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="store-page">
      <div className="store-page-header">
        <div className="store-container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="store-eyebrow mb-3">Help</p>
            <h1 className="font-heading text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
              Quick answers
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-white/80">
              Orders, payments, imports to Ghana, and your account. Plain answers.
            </p>

            <div className="relative mt-8">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for answers..."
                className="store-input rounded-full py-4 pl-12 pr-4 shadow-store-lg"
              />
              <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="store-container store-section">
        <div className="flex flex-wrap gap-3 justify-center mb-12">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`store-chip whitespace-nowrap ${
                activeCategory === category.id ? 'store-chip-active' : ''
              }`}
            >
              <i className={`${category.icon} text-lg`}></i>
              {category.name}
            </button>
          ))}
        </div>

        {filteredFAQs.length > 0 ? (
          <div className="max-w-4xl mx-auto space-y-4">
            {filteredFAQs.map((faq, index) => (
              <details
                key={index}
                className="store-card-interactive overflow-hidden"
              >
                <summary className="px-6 py-5 font-medium text-gray-900 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <span className="flex-1 pr-4">{faq.question}</span>
                  <i className="ri-arrow-down-s-line text-xl text-gray-400"></i>
                </summary>
                <div className="px-6 pb-5 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-search-line text-4xl text-gray-400"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">
              Try adjusting your search or browse different categories
            </p>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-brand-primary to-[#050f1f] py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className="ri-customer-service-2-line text-3xl text-white"></i>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Still have questions?</h2>
          <p className="text-xl text-white/80 mb-8 leading-relaxed">
            Talk to us. We reply within 24 hours.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-white text-brand-primary px-8 py-4 rounded-full font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
            >
              <i className="ri-mail-line text-lg"></i>
              Contact Support
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-brand-accent text-white px-8 py-4 rounded-full font-medium hover:bg-[#e85f12] transition-colors whitespace-nowrap"
            >
              <i className="ri-customer-service-2-line text-lg"></i>
              More help
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Helpful links</h2>
          <p className="text-gray-600">More answers when you need them</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/shipping" className="bg-gray-50 p-8 rounded-2xl hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center mb-4">
              <i className="ri-truck-line text-2xl text-brand-primary"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Shipping</h3>
            <p className="text-gray-600 leading-relaxed">
              How your import travels from China to your door
            </p>
          </Link>

          <Link href="/contact" className="cursor-pointer rounded-2xl bg-gray-50 p-8 transition-all hover:shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
              <i className="ri-customer-service-2-line text-2xl text-brand-primary"></i>
            </div>
            <h3 className="mb-2 text-xl font-bold text-gray-900">Contact</h3>
            <p className="leading-relaxed text-gray-600">
              Ask about an order, payment, or an import issue
            </p>
          </Link>

          <Link href="/privacy" className="bg-gray-50 p-8 rounded-2xl hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center mb-4">
              <i className="ri-shield-check-line text-2xl text-brand-primary"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Privacy</h3>
            <p className="text-gray-600 leading-relaxed">
              How we keep your information safe
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
