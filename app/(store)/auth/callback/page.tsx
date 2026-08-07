'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/**
 * Handles email confirm / password recovery redirects from Supabase.
 * Works with ?code= (PKCE) and hash tokens.
 * Recovery links go to /auth/reset-password so the customer can set a new password.
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    let cancelled = false;
    let recoveryDetected = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        recoveryDetected = true;
      }
    });

    (async () => {
      try {
        const nextParam = searchParams.get('next') || '';
        const typeParam = (searchParams.get('type') || '').toLowerCase();
        const code = searchParams.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (typeof window !== 'undefined' && window.location.hash) {
          const hash = window.location.hash.replace(/^#/, '');
          const hashParams = new URLSearchParams(hash);
          if ((hashParams.get('type') || '').toLowerCase() === 'recovery') {
            recoveryDetected = true;
          }
          await supabase.auth.getSession();
        }

        // Give PASSWORD_RECOVERY a brief moment to fire after exchange
        await new Promise((r) => setTimeout(r, 150));

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (!cancelled) {
            setMessage('Link used or expired. Try signing in.');
          }
          return;
        }

        try {
          await fetch('/api/orders/claim', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({}),
          });
        } catch {
          /* non-blocking */
        }

        const wantsReset =
          recoveryDetected ||
          typeParam === 'recovery' ||
          nextParam === '/auth/reset-password' ||
          nextParam.startsWith('/auth/reset-password');

        const destination = wantsReset
          ? '/auth/reset-password'
          : nextParam.startsWith('/') && !nextParam.startsWith('//')
            ? nextParam
            : '/account';

        if (!cancelled) {
          router.replace(destination);
          router.refresh();
        }
      } catch (err: any) {
        console.error('[auth/callback]', err);
        if (!cancelled) {
          setMessage(err?.message || 'Could not finish sign-in. Try again from the login page.');
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md text-center">
        <p className="text-lg font-semibold text-brand-primary">{message}</p>
        <Link href="/auth/login" className="mt-4 inline-block text-sm font-semibold text-brand-accent underline">
          Go to sign in
        </Link>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <p className="text-slate-500">Loading…</p>
        </main>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
