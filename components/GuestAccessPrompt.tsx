'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Props = {
  orderNumber: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};

function dismissKey(orderNumber: string) {
  return `snappy-skip-access:${orderNumber}`;
}

async function claimOrders(accessToken: string, orderNumber: string) {
  const res = await fetch('/api/orders/claim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ orderNumber }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not link this order.');
  return data;
}

/**
 * Soft post-invoice signup. Same page, never covers the invoice.
 * Guests only. Already signed-in users see nothing (orders get claimed quietly).
 */
export default function GuestAccessPrompt({
  orderNumber,
  email,
  firstName = '',
  lastName = '',
  phone = '',
}: Props) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (sessionStorage.getItem(dismissKey(orderNumber)) === '1') {
          if (!cancelled) setDismissed(true);
        }
      } catch {
        /* ignore */
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session?.user) {
        setSignedIn(true);
        // Quietly attach guest orders for this email when they already have a session.
        if (session.access_token && session.user.email?.toLowerCase() === email.trim().toLowerCase()) {
          try {
            await claimOrders(session.access_token, orderNumber);
          } catch {
            /* non-blocking */
          }
        }
      }

      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [orderNumber, email]);

  const onDismiss = () => {
    try {
      sessionStorage.setItem(dismissKey(orderNumber), '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setExpanded(false);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!acceptTerms) {
      setError('Please accept the terms to create access.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: signError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName || undefined,
            last_name: lastName || undefined,
            phone: phone || undefined,
            from_invoice: orderNumber,
          },
        },
      });

      if (signError) throw signError;

      if (data.session?.access_token) {
        await claimOrders(data.session.access_token, orderNumber);
        setDone(true);
        setSignedIn(true);
        return;
      }

      // Email confirmation may be required. Account exists; claim happens on first sign-in.
      setDone(true);
      setNeedsEmailConfirm(true);
    } catch (err: any) {
      const msg = String(err?.message || 'Could not create access.');
      const lower = msg.toLowerCase();
      if (lower.includes('already registered') || lower.includes('already been registered')) {
        setError('This email already has an account. Sign in to see this order there.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <section className="store-card border border-emerald-200 bg-emerald-50/80 p-5 print:hidden sm:p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-bold text-emerald-900">Access ready</p>
            <p className="mt-1 text-sm text-emerald-800">
              {needsEmailConfirm
                ? `Check ${email} for a confirmation link, then sign in to reopen this invoice and track your order.`
                : 'You can reopen this invoice, pay later, and track your import from your account.'}
            </p>
            <Link
              href={
                needsEmailConfirm
                  ? `/auth/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(`/order/${orderNumber}?email=${email}`)}`
                  : '/account'
              }
              className="mt-3 inline-block text-sm font-semibold text-brand-primary underline"
            >
              {needsEmailConfirm ? 'Go to sign in' : 'Open my orders'}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!ready || signedIn || dismissed) {
    return null;
  }

  return (
    <section className="store-card border border-slate-200/80 bg-slate-50/60 p-5 print:hidden sm:p-6">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Optional</p>
          <h2 className="mt-1 text-lg font-bold text-brand-primary">Keep this order</h2>
          <p className="mt-1 text-sm text-slate-600">
            Reopen this invoice anytime, pay later, and track your import from China to Ghana. Uses{' '}
            <span className="font-semibold text-slate-800">{email}</span>.
          </p>

          {!expanded ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="rounded-full bg-brand-primary px-4 py-2.5 text-sm font-bold text-white"
              >
                Create password access
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
              >
                Not now
              </button>
            </div>
          ) : (
            <form onSubmit={onCreate} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base focus:border-brand-accent focus:outline-none"
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Confirm password
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base focus:border-brand-accent focus:outline-none"
                  required
                  minLength={8}
                />
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  I agree to the{' '}
                  <Link href="/terms" className="font-semibold text-brand-primary underline">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="font-semibold text-brand-primary underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {error.toLowerCase().includes('sign in') ? (
                <Link
                  href={`/auth/login?email=${encodeURIComponent(email)}&next=${encodeURIComponent(`/order/${orderNumber}?email=${email}`)}`}
                  className="inline-block text-sm font-semibold text-brand-primary underline"
                >
                  Sign in instead
                </Link>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-brand-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busy ? 'Creating…' : 'Create access'}
                </button>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
                >
                  Not now
                </button>
              </div>
              <p className="text-xs text-slate-500">
                This does not change your invoice. You can keep paying as a guest.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
