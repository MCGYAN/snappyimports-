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
      answer:
        'Browse products, add them to your cart, and check out. Enter your name, email, and phone. Choose store pickup or doorstep delivery, then complete payment.',
    },
    {
      category: 'orders',
      question: 'I ordered as a guest. How do I see my invoice again?',
      answer:
        'Create an account or sign in with the same email you used at checkout. Your guest invoices and orders show in Order history. You can also use Find my order in the footer with your order number and email.',
    },
    {
      category: 'orders',
      question: 'Where is my order?',
      answer:
        'Sign in and open the order from your account. You will see the import journey from payment through sourcing, shipping to Ghana, and ready or delivered. If you have no account yet, use Find my order in the footer.',
    },
    {
      category: 'orders',
      question: 'Can I change or cancel my order?',
      answer:
        'Message us on WhatsApp or the contact page as soon as you can, with your order number. If payment is confirmed and sourcing has started, changes may not be possible.',
    },
    {
      category: 'shipping',
      question: 'How long does an import take?',
      answer:
        'It depends on the product and shipping method. We update your order status as goods move from China to Ghana. Ask us before you pay if you need a clearer estimate.',
    },
    {
      category: 'shipping',
      question: 'Do you deliver to my door?',
      answer:
        'Yes. At checkout choose doorstep delivery, or choose store pickup. When goods are ready in Ghana, we confirm delivery details and any delivery cost with you.',
    },
    {
      category: 'shipping',
      question: 'Where do goods arrive in Ghana?',
      answer:
        'Imports come into Ghana for clearing, then become ready for pickup or delivery. Your order page shows when that stage is reached.',
    },
    {
      category: 'shipping',
      question: 'What if I miss the delivery call?',
      answer:
        'We will try again or arrange pickup. Keep your phone number correct so we can reach you.',
    },
    {
      category: 'payment',
      question: 'How can I pay?',
      answer:
        'Smaller carts usually pay with Mobile Money at checkout. Larger carts (about GH¢2,000 and above) get an invoice with bank or MoMo transfer details. Pay the invoice, then tap I’ve paid on your order page.',
    },
    {
      category: 'payment',
      question: 'I paid the invoice. What next?',
      answer:
        'Open your order and tap I’ve paid. That tells us to confirm the transfer. After we confirm, your import journey moves forward.',
    },
    {
      category: 'payment',
      question: 'Do you accept cash on delivery?',
      answer:
        'No. Pay online by Mobile Money or by the invoice transfer details before we source and ship.',
    },
    {
      category: 'payment',
      question: 'Can I pay in parts?',
      answer:
        'For some larger imports we may agree a plan. Message us on WhatsApp before you checkout so we can confirm what is possible.',
    },
    {
      category: 'returns',
      question: 'Can I return an item?',
      answer:
        'Import orders are handled case by case. Contact us with your order number and photos if something is wrong, damaged, or not what you ordered. We will tell you the next step clearly.',
    },
    {
      category: 'returns',
      question: 'What if the item is damaged?',
      answer:
        'Tell us quickly with clear photos and your order number. We review it and work out a fix with you.',
    },
    {
      category: 'account',
      question: 'Do I need an account to buy?',
      answer:
        'No. You can checkout as a guest. Creating an account with the same email later lets you reopen invoices, tap I’ve paid, and track orders in one place.',
    },
    {
      category: 'account',
      question: 'How do I create an account?',
      answer:
        'Go to Account, then Create account. Enter your name, phone, email, and a strong password. Agree to the terms. You can sign in right away. No email confirmation step.',
    },
    {
      category: 'account',
      question: 'I forgot my password. What do I do?',
      answer:
        'On the sign-in page, use forgot password if it is available, or contact us on WhatsApp with the email on the order so we can help you get back in.',
    },
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
