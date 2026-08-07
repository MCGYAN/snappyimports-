'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export type EmailRecipient = {
  email: string;
  name?: string;
};

type Props = {
  open: boolean;
  recipients: EmailRecipient[];
  onClose: () => void;
  onSent?: () => void;
};

export default function CustomerEmailModal({ open, recipients, onClose, onSent }: Props) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!open) return null;

  const validRecipients = recipients.filter((r) => r.email && r.email.includes('@'));
  const toLabel =
    validRecipients.length === 1
      ? validRecipients[0].name
        ? `${validRecipients[0].name} (${validRecipients[0].email})`
        : validRecipients[0].email
      : `${validRecipients.length} customers`;

  const handleClose = () => {
    if (sending) return;
    setSubject('');
    setMessage('');
    setError('');
    setSuccess('');
    onClose();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!validRecipients.length) {
      setError('No valid email address to send to.');
      return;
    }
    if (!subject.trim() || !message.trim()) {
      setError('Subject and message are required.');
      return;
    }

    setSending(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sign in required.');
      }

      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          type: 'customer_email',
          payload: {
            subject: subject.trim(),
            message: message.trim(),
            recipients: validRecipients.map((r) => ({
              email: r.email.trim(),
              name: r.name || 'Valued Customer',
            })),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not send email.');
      }

      setSuccess(data.message || 'Email sent.');
      setSubject('');
      setMessage('');
      onSent?.();
      window.setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Could not send email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-primary">Send email</h2>
            <p className="mt-1 text-sm text-slate-500">To: {toLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <i className="ri-close-line text-xl" />
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-3">
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="store-input"
            maxLength={200}
          />
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your message…"
            className="store-input min-h-[140px] resize-y"
            rows={6}
            maxLength={5000}
          />

          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
          {success ? (
            <p className="text-sm text-green-700">{success}</p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={sending}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || validRecipients.length === 0}
              className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
