'use client';

import Link from 'next/link';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { getAuthEmailRedirectTo, getFriendlyAuthError } from '@/lib/auth-copy';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { getToken, verifying } = useRecaptcha();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email) {
      setError('Email is required');
      setIsLoading(false);
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email');
      setIsLoading(false);
      return;
    }

    const isHuman = await getToken('forgot_password');
    if (!isHuman) {
      setError('Security check failed. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: getAuthEmailRedirectTo('/auth/callback'),
      });
      if (resetError) throw resetError;
      setIsSubmitted(true);
    } catch (err: any) {
      setError(getFriendlyAuthError(err?.message || '', 'reset'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-light">
              <i className="ri-mail-send-line text-3xl text-brand-primary"></i>
            </div>
            <h1 className="mb-3 text-2xl font-bold text-gray-900">Check your email</h1>
            <p className="mb-6 text-gray-600">
              If an account exists for <strong>{email}</strong>, we sent a reset link.
            </p>
            <p className="mb-8 text-sm text-gray-500">
              No email yet? Check spam, then try again in a few minutes.
            </p>
            <Link
              href="/auth/login"
              className="inline-block whitespace-nowrap rounded-lg bg-brand-primary px-8 py-3 font-semibold text-white transition-colors hover:bg-[#0d2747]"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">Reset password</h1>
          <p className="text-gray-600">Enter your email. We will send a reset link.</p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent"
                placeholder="you@example.com"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={isLoading || verifying}
              className="w-full rounded-lg bg-brand-primary py-4 font-semibold text-white transition-colors hover:bg-[#0d2747] disabled:opacity-50"
            >
              {isLoading || verifying ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <p className="mt-6 text-center text-gray-600">
            <Link href="/auth/login" className="font-semibold text-brand-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
