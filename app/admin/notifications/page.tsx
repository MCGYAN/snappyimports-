'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function NotificationsPage() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        subject: '',
        message: '',
        audience: 'all',
    });

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('You must be logged in as admin to send campaigns');
            }

            const { data: customers, error: fetchError } = await supabase
                .from('customers')
                .select('email, full_name, secondary_email');

            if (fetchError) throw fetchError;

            const seenEmails = new Set<string>();
            const recipients: { email: string; name: string | null }[] = [];

            for (const c of customers || []) {
                const emails = [c.email, c.secondary_email]
                    .filter(Boolean)
                    .map((email: string) => email.toLowerCase().trim());

                const uniqueEmail = emails.find((email) => !seenEmails.has(email)) || null;
                if (!uniqueEmail) continue;

                emails.forEach((email) => seenEmails.add(email));
                recipients.push({ email: uniqueEmail, name: c.full_name });
            }

            if (recipients.length === 0) {
                throw new Error('No recipients found with a valid email address');
            }

            if (
                !window.confirm(
                    `This will send ${recipients.length} emails to your customers. Continue?`,
                )
            ) {
                setLoading(false);
                return;
            }

            const BATCH_SIZE = 50;
            let totalEmail = 0;
            let totalErrors = 0;

            for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
                const batch = recipients.slice(i, i + BATCH_SIZE);

                const res = await fetch('/api/notifications', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        type: 'campaign',
                        payload: {
                            recipients: batch,
                            subject: form.subject,
                            message: form.message,
                            channels: { email: true, sms: false },
                        },
                    }),
                });

                let data;
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json')) {
                    data = await res.json();
                } else {
                    const text = await res.text();
                    throw new Error(
                        `Server error (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${text.slice(0, 100)}`,
                    );
                }

                if (!res.ok) throw new Error(data.error || 'Failed to send');

                const msg = data.message || '';
                const emailMatch = msg.match(/(\d+) emails/);
                const errorMatch = msg.match(/(\d+) failed/);
                if (emailMatch) totalEmail += parseInt(emailMatch[1], 10);
                if (errorMatch) totalErrors += parseInt(errorMatch[1], 10);
            }

            const errorNote = totalErrors > 0 ? ` (${totalErrors} failed)` : '';
            setSuccess(
                totalEmail > 0
                    ? `Campaign sent successfully! ${totalEmail} emails sent.${errorNote}`
                    : `Campaign finished.${errorNote}`,
            );
            setForm((prev) => ({ ...prev, subject: '', message: '' }));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Marketing & Notifications</h1>

            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-semibold mb-6">Send New Campaign</h2>

                {success && (
                    <div className="bg-brand-primary/5 text-brand-primary p-4 rounded-lg mb-4">
                        {success}
                    </div>
                )}
                {error && (
                    <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">{error}</div>
                )}

                <form onSubmit={handleSend} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Audience
                        </label>
                        <select
                            value={form.audience}
                            onChange={(e) => setForm({ ...form, audience: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-accent/25"
                        >
                            <option value="all">All Customers</option>
                            <option value="newsletter">Newsletter Subscribers</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Email Subject
                        </label>
                        <input
                            type="text"
                            value={form.subject}
                            onChange={(e) => setForm({ ...form, subject: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-accent/25"
                            placeholder="e.g., Summer Sale Starts Now!"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Message Content
                        </label>
                        <textarea
                            value={form.message}
                            onChange={(e) => setForm({ ...form, message: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg h-40 outline-none focus:ring-2 focus:ring-brand-accent/25"
                            placeholder="Write your email message here..."
                            required
                        />
                        <p className="text-sm text-gray-500 mt-1">
                            This becomes the email body. Plain text is fine.
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-brand-primary text-white py-4 rounded-lg font-bold text-lg hover:bg-brand-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center">
                                <i className="ri-loader-4-line animate-spin mr-2"></i> Sending...
                            </span>
                        ) : (
                            'Send Email Campaign'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
