/** Public site origin for auth emails and redirects. Prefer live URL over localhost. */
export function getPublicAppUrl(): string {
  const envUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    const origin = window.location.origin.replace(/\/+$/, '');
    if (!/localhost|127\.0\.0\.1/i.test(origin)) return origin;
  }
  if (envUrl && !/localhost|127\.0\.0\.1/i.test(envUrl)) return envUrl;
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/+$/, '');
  return 'https://snappyimports.vercel.app';
}

/** Where Supabase should send people after they confirm email / reset password. */
export function getAuthEmailRedirectTo(path = '/auth/callback'): string {
  const base = getPublicAppUrl();
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}`;
}

/** Friendly auth error copy for customers (not raw browser / Supabase text). */
export function getFriendlyAuthError(message: string, context: 'login' | 'signup' | 'reset' = 'login'): string {
  const lower = (message || '').toLowerCase();

  if (
    lower.includes('load failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('fetch')
  ) {
    return 'Could not connect right now. Check your internet and try again.';
  }

  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'Could not sign in. Check your email and password, or create an account.';
  }

  if (lower.includes('email not confirmed') || lower.includes('not confirmed')) {
    return 'Please confirm your email first. Check your inbox for the Snappy link.';
  }

  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  if (lower.includes('password') && (lower.includes('weak') || lower.includes('least'))) {
    return 'Use a stronger password. At least 8 characters.';
  }

  if (lower.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }

  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many tries. Wait a few minutes, then try again.';
  }

  if (context === 'signup') {
    return message || 'Could not create your account. Please try again.';
  }
  if (context === 'reset') {
    return message || 'Could not send reset email. Please try again.';
  }
  return message || 'Could not sign in. Please try again.';
}
