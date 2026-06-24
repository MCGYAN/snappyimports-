"use client";

import { useState } from 'react';
import Link from 'next/link';

export default function FAQsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All Questions', icon: 'ri-question-line' },
    { id: 'orders', name: 'Orders', icon: 'ri-shopping-bag-line' },
    { id: 'shipping', name: 'Shipping', icon: 'ri-truck-line' },
    { id: 'returns', name: 'Returns', icon: 'ri-arrow-go-back-line' },
    { id: 'payment', name: 'Payment', icon: 'ri-bank-card-line' },
    { id: 'account', name: 'Account', icon: 'ri-user-line' }
  ];

  const faqs = [
    {
      category: 'orders',
      question: 'How do I place an order?',
      answer: 'Browse what you need. Add it to your cart. Check out or message us on WhatsApp. We confirm everything before you pay.'
    },
    {
      category: 'orders',
      question: 'Can I change or cancel my order?',
      answer: 'Yes, within one hour of ordering. Contact us right away. After that, we may already be sourcing your item.'
    },
    {
      category: 'orders',
      question: 'Where is my order?',
      answer: 'Go to order tracking and enter your order number and email. You see every step from China to Ghana.'
    },
    {
      category: 'orders',
      question: 'What if I get the wrong item?',
      answer: 'Tell us within 48 hours with photos. We fix it fast. Wrong items are collected at no cost to you.'
    },
    {
      category: 'shipping',
      question: 'How long does delivery take?',
      answer: 'Sea freight takes a few weeks. Air is faster. We give you a real date up front, not a vague promise.'
    },
    {
      category: 'shipping',
      question: 'How much does shipping cost?',
      answer: 'It depends on size, weight, and method. We quote the full landed cost before you commit. No surprise fees.'
    },
    {
      category: 'shipping',
      question: 'Do you ship outside Ghana?',
      answer: 'We focus on China to Ghana. Ask us if you need something else. We will tell you honestly.'
    },
    {
      category: 'shipping',
      question: 'What if nobody is home?',
      answer: 'We try twice. Then we hold it for pickup. You get a text and email with instructions.'
    },
    {
      category: 'returns',
      question: 'Can I return an item?',
      answer: 'Yes, within 14 days if unused and in original packaging. Start a return from your account. Refunds take 5 to 7 days.'
    },
    {
      category: 'returns',
      question: 'What cannot be returned?',
      answer: 'Opened personal care items, custom orders, and perishables cannot be returned unless they are defective.'
    },
    {
      category: 'returns',
      question: 'Who pays return shipping?',
      answer: 'We cover it if it is our mistake or a defect. For change of mind, you usually pay return shipping.'
    },
    {
      category: 'returns',
      question: 'Can I swap for a different size?',
      answer: 'Yes. Choose exchange when you start your return. We send the new one when we get the old one back.'
    },
    {
      category: 'payment',
      question: 'How can I pay?',
      answer: 'MOMO, bank transfer, cash in store, or card. We do not accept payment on delivery.'
    },
    {
      category: 'payment',
      question: 'Is my card safe?',
      answer: 'Yes. We use secure encryption. We never store your full card number on our servers.'
    },
    {
      category: 'payment',
      question: 'Can I pay in parts?',
      answer: 'Big imports may allow staged payments. We explain the plan before you agree to anything.'
    },
    {
      category: 'payment',
      question: 'When am I charged?',
      answer: 'Right when you pay online or in store. If something is out of stock, we refund you within 24 hours.'
    },
    {
      category: 'payment',
      question: 'How do refunds work?',
      answer: 'Money goes back to how you paid. It takes 5 to 7 business days. We email you when it is done.'
    },
    {
      category: 'account',
      question: 'Do I need an account?',
      answer: 'No. You can check out as a guest. An account lets you track orders and save your details for next time.'
    },
    {
      category: 'account',
      question: 'How do I reset my password?',
      answer: 'Click forgot password on the login page. We email you a link. It works for one hour.'
    },
    {
      category: 'account',
      question: 'Can I save more than one address?',
      answer: 'Yes. Save home, work, or any address. Pick the right one at checkout.'
    },
    {
      category: 'account',
      question: 'How do I update my details?',
      answer: 'Log in and go to account settings. Change your name, email, phone, or password anytime.'
    },
    {
      category: 'account',
      question: 'Do you have loyalty points?',
      answer: 'If a rewards programme is active, you see your points in your account after you buy.'
    }
  ];

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
              Common questions about orders, shipping, payments, and returns. Plain and simple.
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

          <Link href="/returns" className="bg-gray-50 p-8 rounded-2xl hover:shadow-lg transition-all cursor-pointer">
            <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center mb-4">
              <i className="ri-arrow-go-back-line text-2xl text-brand-primary"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Returns</h3>
            <p className="text-gray-600 leading-relaxed">
              How to return an item and get your money back
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
