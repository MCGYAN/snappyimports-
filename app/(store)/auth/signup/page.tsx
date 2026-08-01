'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PasswordStrengthMeter from '@/components/PasswordStrengthMeter';
import { supabase } from '@/lib/supabase';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import {
  getFriendlyAuthError,
  getPasswordIssues,
  isStrongPassword,
  isValidGhPhone,
} from '@/lib/auth-copy';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';
  const errorRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
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
    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!isValidGhPhone(formData.phone)) {
      newErrors.phone = 'Use a valid Ghana number, like 0244123456';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!isStrongPassword(formData.password)) {
      newErrors.password = getPasswordIssues(formData.password).join('. ') + '.';
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
          data: {
            first_name: formData.firstName.trim(),
            last_name: formData.lastName.trim(),
            phone: formData.phone.trim(),
            full_name: `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim(),
          },
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
              firstName: formData.firstName.trim(),
            },
          }),
        }).catch(() => {});

        if (data.session?.access_token) {
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
          return;
        }

        // Autoconfirm should return a session; if not, send them to sign in.
        router.push(
          `/auth/login?email=${encodeURIComponent(formData.email.trim())}&next=/account`,
        );
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setAuthError(getFriendlyAuthError(err.message || '', 'signup'));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = (hasError?: boolean) =>
    `w-full rounded-lg border-2 px-4 py-3 focus:border-brand-accent focus:outline-none focus:ring-2 focus:ring-brand-accent ${
      hasError ? 'border-red-500' : 'border-gray-300'
    }`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 sm:text-4xl">Create account</h1>
          <p className="text-gray-600">
            Save your details once. Then reopen invoices and track orders anytime.
          </p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-sm">
          {authError ? (
            <div
              ref={errorRef}
              className="mb-4 space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <p>{authError}</p>
              {authError.toLowerCase().includes('sign in') ? (
                <Link
                  href={`/auth/login${formData.email ? `?email=${encodeURIComponent(formData.email.trim())}` : ''}`}
                  className="inline-block font-semibold text-brand-primary underline"
                >
                  Sign in instead
                </Link>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="on">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">First name</label>
                <input
                  type="text"
                  name="given-name"
                  autoComplete="given-name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className={inputClass(Boolean(errors.firstName))}
                  placeholder="Ama"
                />
                {errors.firstName ? <p className="mt-1 text-sm text-red-600">{errors.firstName}</p> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-900">Last name</label>
                <input
                  type="text"
                  name="family-name"
                  autoComplete="family-name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className={inputClass(Boolean(errors.lastName))}
                  placeholder="Mensah"
                />
                {errors.lastName ? <p className="mt-1 text-sm text-red-600">{errors.lastName}</p> : null}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Phone</label>
              <input
                type="tel"
                name="tel"
                autoComplete="tel"
                inputMode="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={inputClass(Boolean(errors.phone))}
                placeholder="0244123456"
              />
              {errors.phone ? <p className="mt-1 text-sm text-red-600">{errors.phone}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Email</label>
              <input
                type="email"
                name="email"
                autoComplete="username email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputClass(Boolean(errors.email))}
                placeholder="you@example.com"
              />
              {errors.email ? <p className="mt-1 text-sm text-red-600">{errors.email}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="new-password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`${inputClass(Boolean(errors.password))} pr-12`}
                  placeholder="Create a strong password"
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
              <p className="mt-1 text-xs text-slate-500">
                Your browser can offer to save this password for next time.
              </p>
              {errors.password ? <p className="mt-1 text-sm text-red-600">{errors.password}</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-900">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirm-password"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`${inputClass(Boolean(errors.confirmPassword))} pr-12`}
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
