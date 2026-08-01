'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/**
 * Handles email confirm / password recovery redirects from Supabase.
 * Works with ?code= (PKCE) and hash tokens.
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const code = searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (typeof window !== 'undefined' && window.location.hash) {
          // Implicit hash tokens are parsed by the client automatically on getSession
          await supabase.auth.getSession();
        }

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

        if (!cancelled) {
          router.replace('/account');
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
