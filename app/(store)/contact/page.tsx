"use client";

import { useState, useEffect } from 'react';
import { useCMS } from '@/context/CMSContext';
import { supabase } from '@/lib/supabase';
import PageHero from '@/components/PageHero';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useRecaptcha } from '@/hooks/useRecaptcha';

export default function ContactPage() {
  usePageTitle('Contact Us');
  const { getSetting } = useCMS();
  const [pageContent, setPageContent] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitError, setSubmitError] = useState<string>('');
  const { getToken, verifying } = useRecaptcha();

  useEffect(() => {
    async function fetchContactContent() {
      const { data } = await supabase
        .from('cms_content')
        .select('*')
        .eq('section', 'contact')
        .eq('block_key', 'main')
        .single();

      if (data) {
        setPageContent(data);
      }
    }
    fetchContactContent();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setSubmitError('');

    // reCAPTCHA verification
    const isHuman = await getToken('contact');
    if (!isHuman) {
      setSubmitStatus('error');
      setSubmitError('Security verification failed. Please try again.');
      setIsSubmitting(false);
      return;
    }

    try {
      // Store in Supabase
      const { error } = await supabase
        .from('contact_submissions')
        .insert({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          subject: formData.subject,
          message: formData.message,
        });

      if (error) {
        // Table might not exist, still show success
        console.log('Note: contact_submissions table may not exist');
      }

      // Send Contact Notification (await so we can show email errors)
      const notifRes = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contact',
          payload: formData
        })
      });
      const notifData = await notifRes.json().catch(() => ({}));
      if (!notifRes.ok) {
        setSubmitError(notifData.error || `Request failed (${notifRes.status})`);
        setSubmitStatus('error');
        setIsSubmitting(false);
        return;
      }

      setSubmitStatus('success');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (error) {
      setSubmitStatus('error');
      setSubmitError(error instanceof Error ? error.message : 'Failed to send message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get contact details from CMS settings (defaults are neutral placeholders)
  const contactEmail = getSetting('contact_email') || 'contact@example.com';
  const contactPhone = getSetting('contact_phone') || '';
  const contactWhatsapp = getSetting('contact_whatsapp') || '';
  const primaryAddressLine = getSetting('contact_address') || '';
  const secondaryAddressLine = getSetting('contact_address_tarkwa') || '';
  const socialFacebook = getSetting('social_facebook') || '';
  const socialInstagram = getSetting('social_instagram') || '';
  const socialTikTok = getSetting('social_tiktok') || '';

  const heroTitle = pageContent?.title || 'Get In Touch';
  const heroSubtitle = pageContent?.subtitle || 'Have a question or need assistance?';
  const heroContent = pageContent?.content || 'Our friendly team is here to help. Reach out through any of our contact channels.';

  const defaultCc = (process.env.NEXT_PUBLIC_DEFAULT_PHONE_COUNTRY_CODE || '1').replace(/\D/g, '') || '1';
  const waNumber = contactWhatsapp.replace(/[^0-9]/g, '');
  const waLink = waNumber
    ? `https://wa.me/${waNumber.startsWith('0') ? `${defaultCc}${waNumber.slice(1)}` : waNumber}`
    : '';
  const telNumber = contactPhone.replace(/\s/g, '');
  const telLink = telNumber
    ? telNumber.startsWith('+')
      ? `tel:${telNumber}`
      : telNumber.startsWith('0')
        ? `tel:+${defaultCc}${telNumber.slice(1)}`
        : `tel:${telNumber}`
    : '';

  const addressParts = [primaryAddressLine, secondaryAddressLine].filter(Boolean);
  const locationDescription = addressParts.length ? addressParts.join(' • ') : '';

  const contactMethods = [
    ...(contactPhone
      ? [
          {
            icon: 'ri-phone-line',
            title: 'Call Us',
            value: contactPhone,
            link: telLink,
            description: 'Mon-Fri, 8am-6pm GMT',
          },
        ]
      : []),
    {
      icon: 'ri-mail-line',
      title: 'Email Us',
      value: contactEmail,
      link: `mailto:${contactEmail}`,
      description: 'We respond within 24 hours',
    },
    ...(contactWhatsapp
      ? [
          {
            icon: 'ri-whatsapp-line',
            title: 'WhatsApp',
            value: contactWhatsapp,
            link: waLink,
            description: 'Chat with us instantly',
          },
        ]
      : []),
    ...(socialFacebook
      ? [
          {
            icon: 'ri-facebook-circle-line',
            title: 'Facebook',
            value: 'Facebook',
            link: socialFacebook,
            description: 'Follow us for updates',
          },
        ]
      : []),
    ...(socialInstagram
      ? [
          {
            icon: 'ri-instagram-line',
            title: 'Instagram',
            value: 'Instagram',
            link: socialInstagram,
            description: 'Photos and updates',
          },
        ]
      : []),
    ...(socialTikTok
      ? [
          {
            icon: 'ri-tiktok-line',
            title: 'TikTok',
            value: 'TikTok',
            link: socialTikTok,
            description: 'Short videos',
          },
        ]
      : []),
  ];

  const faqs = [
    {
      question: 'How long does an import take?',
      answer: 'It depends on air or sea and what you are buying. We give you a real date up front. We update you if anything changes. No vague "soon" answers.'
    },
    {
      question: 'Do you only ship to Ghana?',
      answer: 'Yes. China to Ghana is what we do best. Ask us if you need something different. We will tell you honestly.'
    },
    {
      question: 'How do I pay?',
      answer: 'MOMO, bank transfer, cash in store, or card. Big orders may need staged payments. We explain everything before you commit.'
    }
  ];

  return (
    <div className="store-page">
      <PageHero
        size="large"
        title="We are here to help"
        subtitle="Quotes, timelines, or a quick question. Talk to real people who move imports from China to Ghana."
      />

        <div className="store-container store-section">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {contactMethods.map((method, index) => (
            <a
              key={index}
              href={method.link}
              target={method.link.startsWith('http') ? '_blank' : '_self'}
              rel={method.link.startsWith('http') ? 'noopener noreferrer' : ''}
              className="liquid-glass-card liquid-glass-card-interactive cursor-pointer p-6 transition-all"
            >
              <div className="w-12 h-12 bg-brand-light rounded-full flex items-center justify-center mb-4">
                <i className={`${method.icon} text-2xl text-brand-primary`}></i>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{method.title}</h3>
              <p className="text-brand-primary font-medium mb-1">{method.value}</p>
              <p className="text-sm text-gray-500">{method.description}</p>
            </a>
          ))}
        </div>


        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Send a message</h2>
            <p className="text-gray-600 mb-8">
              Tell us what you need. We reply within 24 hours.
            </p>

            <form id="contactForm" onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-accent focus:border-transparent text-sm"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-accent focus:border-transparent text-sm"
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-accent focus:border-transparent text-sm"
                  placeholder="+1 555 000 0000"
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-accent focus:border-transparent text-sm"
                  placeholder="Order inquiry, product question, etc."
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={6}
                  maxLength={500}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-none text-sm"
                  placeholder="Tell us how we can help you..."
                ></textarea>
                <p className="text-xs text-gray-500 mt-1">{formData.message.length}/500 characters</p>
              </div>

              {submitStatus === 'success' && (
                <div className="bg-blue-50 border border-blue-200 text-brand-primary px-4 py-3 rounded-xl">
                  <i className="ri-check-line mr-2"></i>
                  Message sent successfully! We'll respond within 24 hours.
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                  <i className="ri-error-warning-line mr-2"></i>
                  {submitError || 'Failed to send message. Please try again or contact us directly.'}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || verifying}
                className="w-full bg-brand-primary text-white py-4 rounded-xl font-medium hover:bg-[#0d2747] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {isSubmitting || verifying ? (verifying ? 'Verifying...' : 'Sending...') : 'Send Message'}
              </button>
            </form>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Quick answers</h2>
            <p className="text-gray-600 mb-8">
              Common questions before you reach out
            </p>

            <div className="space-y-4 mb-12">
              {faqs.map((faq, index) => (
                <details key={index} className="bg-gray-50 rounded-xl overflow-hidden">
                  <summary className="px-6 py-4 font-medium text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors">
                    {faq.question}
                  </summary>
                  <div className="px-6 pb-4 text-gray-600 leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>

            <div className="bg-gradient-to-br from-blue-700 to-blue-900 p-8 rounded-2xl text-white">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-4">
                <i className="ri-customer-service-2-line text-2xl"></i>
              </div>
              <h3 className="text-2xl font-bold mb-3">Need help now?</h3>
              <p className="text-blue-100 mb-6 leading-relaxed">
                We are here Monday to Friday, 8am to 6pm. For urgent questions, message us on WhatsApp.
              </p>
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white text-brand-primary px-6 py-3 rounded-full font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
                >
                  <i className="ri-whatsapp-line text-xl"></i>
                  Chat on WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
