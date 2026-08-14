'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function NotificationsPage() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [recipientCount, setRecipientCount] = useState<number | null>(null);
    const [form, setForm] = useState({
        subject: '',
        message: '',
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { count, error: countError } = await supabase
                    .from('customers')
                    .select('id', { count: 'exact', head: true })
                    .not('email', 'is', null)
                    .neq('email', '');
                if (!cancelled && !countError) {
                    setRecipientCount(count ?? 0);
                }
            } catch {
                // Count is informational only
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('You must be logged in as admin to send campaigns');
            }

            const confirmText =
                recipientCount != null
                    ? `Send this email to about ${recipientCount} customers?`
                    : 'Send this email to all customers with an email address?';

            if (!window.confirm(confirmText)) {
                setLoading(false);
                return;
            }

            const res = await fetch('/api/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    type: 'campaign',
                    payload: {
                        subject: form.subject.trim(),
                        message: form.message.trim(),
                    },
                }),
            });

            let data: any = {};
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                data = await res.json();
            } else {
                const text = await res.text();
                throw new Error(text.slice(0, 120) || 'Server error');
            }

            if (!res.ok) {
                throw new Error(data.error || 'Failed to send campaign');
            }

            setSuccess(data.message || 'Campaign sent.');
            setForm({ subject: '', message: '' });
            if (typeof data.sent === 'number') {
                setRecipientCount(data.sent + (data.failed || 0));
            }
        } catch (err: any) {
            setError(err.message || 'Failed to send campaign');
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
                    <p className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                        {recipientCount == null
                            ? 'Sends to all customers with an email address via Resend.'
                            : `Sends via Resend to ${recipientCount} customer${recipientCount === 1 ? '' : 's'} with an email address.`}
                    </p>

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
                            maxLength={200}
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
                            maxLength={5000}
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
