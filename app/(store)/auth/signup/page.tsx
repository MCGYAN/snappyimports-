'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import { supabase } from '@/lib/supabase';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { getAuthEmailRedirectTo, getFriendlyAuthError } from '@/lib/auth-copy';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';
  const errorRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    email: emailFromQuery,
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [success, setSuccess] = useState(false);
  const { getToken, verifying } = useRecaptcha();

  useEffect(() => {
    if (emailFromQuery) {
      setFormData((prev) => ({ ...prev, email: emailFromQuery }));
    }
  }, [emailFromQuery]);

  useEffect(() => {
    if (authError && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [authError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAuthError('');
    setIsLoading(true);

    const newErrors: Record<string, string> = {};
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'Please accept the terms to continue';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    const isHuman = await getToken('signup');
    if (!isHuman) {
      setAuthError('Security check failed. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email.trim(),
        password: formData.password,
        options: {
          emailRedirectTo: getAuthEmailRedirectTo('/auth/callback'),
        },
      });

      if (error) throw error;

      if (data.user) {
        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'welcome',
            payload: {
              email: formData.email.trim(),
              firstName: '',
            },
          }),
        }).catch(() => {});

        if (!data.session) {
          setSuccess(true);
        } else {
          try {
            await fetch('/api/orders/claim', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${data.session.access_token}`,
              },
              body: JSON.stringify({}),
            });
          } catch {
            /* non-blocking */
          }
          router.push('/account');
          router.refresh();
        }
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setAuthError(getFriendlyAuthError(err.message || '', 'signup'));
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-light">
            <i className="ri-mail-send-line text-4xl text-brand-accent"></i>
          </div>
          <h1 className="mb-4 text-3xl font-bold text-gray-900">Check your email</h1>
          <p className="mb-8 text-gray-600">
            We sent a link to <strong>{formData.email}</strong>.
            <br />
            Open it to finish creating your Snappy account.
          </p>
          <Link
            href="/auth/login"
            className="inline-block rounded-lg bg-brand-primary px-8 py-3 font-semibold text-white transition-colors hover:bg-[#0d2747]"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 sm:text-4xl">Create account</h1>
          <p className="text-gray-600">Just your email and a password. That is all.</p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-sm">
          {authError ? (
            <div
              ref={errorRef}
              className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <i className="ri-error-warning-line mt-0.5 flex-shrink-0 text-lg text-red-500"></i>
              <span>{authError}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Email</label>
              <input
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full rounded-lg border-2 px-4 py-3 focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="you@example.com"
              />
              {errors.email ? <p className="mt-1 text-sm text-red-600">{errors.email}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full rounded-lg border-2 px-4 py-3 pr-12 focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-xl`}></i>
                </button>
              </div>
              <PasswordStrengthMeter password={formData.password} />
              {errors.password ? <p className="mt-1 text-sm text-red-600">{errors.password}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`w-full rounded-lg border-2 px-4 py-3 pr-12 focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Type it again"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <i className={`${showConfirmPassword ? 'ri-eye-off-line' : 'ri-eye-line'} text-xl`}></i>
                </button>
              </div>
              {errors.confirmPassword ? (
                <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
              ) : null}
            </div>

            <div>
              <label className="flex cursor-pointer items-start space-x-3">
                <input
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={(e) => setFormData({ ...formData, acceptTerms: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded text-brand-accent focus:ring-brand-accent"
                />
                <span className="text-sm text-gray-700">
                  I agree to the{' '}
                  <Link href="/terms" className="font-medium text-brand-primary whitespace-nowrap hover:underline">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="font-medium text-brand-primary whitespace-nowrap hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {errors.acceptTerms ? <p className="mt-2 text-sm text-red-600">{errors.acceptTerms}</p> : null}
            </div>

            <button
              type="submit"
              disabled={isLoading || verifying}
              className="w-full cursor-pointer whitespace-nowrap rounded-lg bg-brand-primary py-4 font-semibold text-white transition-colors hover:bg-[#0d2747] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading || verifying ? (
                <span className="flex items-center justify-center">
                  <i className="ri-loader-4-line mr-2 animate-spin"></i>
                  {verifying ? 'Checking…' : 'Creating account…'}
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/login" className="whitespace-nowrap font-semibold text-brand-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="whitespace-nowrap font-medium text-gray-600 hover:text-gray-900">
            <i className="ri-arrow-left-line mr-2"></i>
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
          <p className="text-slate-500">Loading…</p>
        </main>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
