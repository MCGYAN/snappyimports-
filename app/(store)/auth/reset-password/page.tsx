'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  getFriendlyAuthError,
  getPasswordIssues,
  isStrongPassword,
} from '@/lib/auth-copy';

function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!cancelled) {
        setHasSession(Boolean(session));
        setChecking(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasSession(Boolean(session));
        setChecking(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isStrongPassword(password)) {
      setError(getPasswordIssues(password).join('. ') + '.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => {
        router.replace('/auth/login');
        router.refresh();
      }, 1800);
    } catch (err: any) {
      setError(getFriendlyAuthError(err?.message || '', 'reset'));
    } finally {
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <p className="text-slate-500">Checking your reset link…</p>
      </main>
    );
  }

  if (!hasSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <i className="ri-link-unlink text-3xl text-red-600"></i>
          </div>
          <h1 className="mb-3 text-2xl font-bold text-gray-900">Link expired</h1>
          <p className="mb-8 text-gray-600">
            This reset link was used or expired. Request a new one from the sign-in page.
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-block rounded-lg bg-brand-primary px-8 py-3 font-semibold text-white transition-colors hover:bg-[#0d2747]"
          >
            Request new link
          </Link>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-light">
            <i className="ri-checkbox-circle-line text-3xl text-brand-primary"></i>
          </div>
          <h1 className="mb-3 text-2xl font-bold text-gray-900">Password updated</h1>
          <p className="mb-2 text-gray-600">You can sign in with your new password.</p>
          <p className="text-sm text-gray-500">Taking you to sign in…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">Choose a new password</h1>
          <p className="text-gray-600">Pick a strong password for your account.</p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 pr-12 focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={showPassword ? 'ri-eye-off-line text-xl' : 'ri-eye-line text-xl'}></i>
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Use 8+ characters with upper and lower case, a number, and a symbol.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent"
                placeholder="Type it again"
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-brand-primary py-4 font-semibold text-white transition-colors hover:bg-[#0d2747] disabled:opacity-50"
            >
              {isLoading ? 'Saving…' : 'Save new password'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <p className="text-slate-500">Loading…</p>
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
