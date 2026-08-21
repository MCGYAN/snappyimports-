'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { getFriendlyAuthError } from '@/lib/auth-copy';
import {
  getAuthCookies,
  loadRememberedLogin,
  setRememberMePreference,
  setRememberedCredentials,
  syncAuthCookies,
} from '@/lib/auth-remember';

function isSafariBrowser() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Android|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

/**
 * Full navigation with credential fields so Safari/Chrome can offer Save Password.
 * SPA router.push() does not trigger the browser password manager.
 */
function submitBrowserPasswordSave(opts: {
  email: string;
  password: string;
  nextPath: string;
}) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/auth/logged-in';
  form.style.display = 'none';
  form.setAttribute('autocomplete', 'on');

  const fields: Array<{ name: string; value: string; type?: string; autocomplete?: string }> = [
    {
      name: 'username',
      value: opts.email,
      type: 'email',
      autocomplete: 'username',
    },
    {
      name: 'password',
      value: opts.password,
      type: 'password',
      autocomplete: 'current-password',
    },
    { name: 'next', value: opts.nextPath },
  ];

  for (const field of fields) {
    const input = document.createElement('input');
    input.type = field.type || 'text';
    input.name = field.name;
    input.value = field.value;
    if (field.autocomplete) input.autocomplete = field.autocomplete as AutoFill;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/account';
  const emailFromQuery = searchParams.get('email') || '';
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const safari = isSafariBrowser();

  const [formData, setFormData] = useState({
    email: emailFromQuery,
    password: '',
    rememberMe: true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const { getToken, verifying } = useRecaptcha();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remembered = await loadRememberedLogin();
      if (cancelled) return;
      const nextEmail = emailFromQuery || remembered.email || '';

      // On Safari, leave password empty so the system Passwords autofill can run.
      // Filling it from our storage blocks Safari's keychain prompt.
      setFormData((prev) => ({
        ...prev,
        rememberMe: remembered.rememberMe,
        email: nextEmail || prev.email,
        password: safari ? '' : remembered.password || prev.password,
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [emailFromQuery, safari]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        const cookies = getAuthCookies();
        if (cookies) {
          const restored = await supabase.auth.setSession(cookies);
          session = restored.data.session;
        }
      }
      if (cancelled || !session) return;
      const safeNext =
        nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/account';
      router.replace(safeNext);
    })();
    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAuthError('');
    setIsLoading(true);

    // Prefer live DOM password (Safari Passwords may fill the field without React state).
    const passwordFromDom = passwordInputRef.current?.value || formData.password;

    const newErrors: any = {};
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!passwordFromDom) {
      newErrors.password = 'Password is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setIsLoading(false);
      return;
    }

    const isHuman = await getToken('login');
    if (!isHuman) {
      setAuthError('Security check failed. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      setRememberMePreference(formData.rememberMe);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: formData.email.trim(),
        password: passwordFromDom,
      });

      if (error) {
        throw error;
      }

      if (data.session?.access_token) {
        if (formData.rememberMe) {
          setRememberedCredentials(formData.email.trim(), passwordFromDom);
        } else {
          setRememberedCredentials(null, null);
        }
        syncAuthCookies(data.session, formData.rememberMe);

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

        const safeNext =
          nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/account';

        // Real form POST + navigation triggers Safari/Chrome "Save Password?"
        submitBrowserPasswordSave({
          email: formData.email.trim(),
          password: passwordFromDom,
          nextPath: safeNext,
        });
        return;
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setAuthError(getFriendlyAuthError(error?.message || '', 'login'));
      setIsLoading(false);
    }
  };

  return (
    <main className="store-page flex min-h-screen items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="store-eyebrow mb-2">Account</p>
          <h1 className="font-heading text-3xl font-bold text-brand-primary sm:text-4xl">Welcome back</h1>

          <p className="mt-2 text-slate-500">Track your imports and manage your account</p>
        </div>

        <div className="store-card p-8 md:p-10">
          {authError ? (
            <div className="mb-4 space-y-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p>{authError}</p>
              <Link
                href={`/auth/signup${formData.email ? `?email=${encodeURIComponent(formData.email.trim())}` : ''}`}
                className="inline-block font-semibold text-brand-primary underline"
              >
                Create a new account
              </Link>
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
            autoComplete="on"
            method="post"
            action="/auth/logged-in"
          >
            <div>
              <label htmlFor="login-username" className="mb-2 block text-sm font-semibold text-gray-900">
                Email Address
              </label>
              <input
                id="login-username"
                type="email"
                name="username"
                autoComplete="username"
                inputMode="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`store-input border-2 ${errors.email ? 'border-red-500' : 'border-slate-200'
                  }`}
                placeholder="you@example.com"
                required
              />
              {errors.email && (
                <p className="mt-2 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="current-password" className="mb-2 block text-sm font-semibold text-gray-900">
                Password
              </label>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  id="current-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full rounded-xl border border-gray-200 px-4 py-3.5 pr-12 transition-colors focus:border-gray-400 focus:ring-2 focus:ring-gray-900/10 ${errors.password ? 'border-red-400' : ''
                    }`}
                  placeholder="Enter your password"
                  required
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
              {errors.password && (
                <p className="text-sm text-red-600 mt-2">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.rememberMe}
                  onChange={(e) => setFormData({ ...formData, rememberMe: e.target.checked })}
                  className="w-4 h-4 text-brand-accent rounded focus:ring-brand-accent"
                />
                <span className="text-sm text-gray-700">Remember me</span>
              </label>
              <Link href="/auth/forgot-password" className="text-sm text-brand-primary hover:text-brand-primary font-medium whitespace-nowrap">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading || verifying}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white py-3.5 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
            >
              {isLoading || verifying ? (
                <span className="flex items-center justify-center">
                  <i className="ri-loader-4-line animate-spin mr-2"></i> {verifying ? 'Verifying...' : 'Signing in...'}
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-center text-gray-600">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-brand-primary hover:text-brand-primary font-semibold whitespace-nowrap">
              Create one now
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap">
            <i className="ri-arrow-left-line mr-2"></i>
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="store-page flex min-h-screen items-center justify-center px-4 py-12">
          <p className="text-slate-500">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
