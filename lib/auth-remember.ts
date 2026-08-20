/**
 * Customer "Remember me" preference for storefront auth.
 * Checked: keep session across browser restarts, and autofill email + password on the login form.
 * Unchecked: session ends with the browser tab, and saved login fields are cleared.
 *
 * Saved credentials stay only in this browser's localStorage (never sent to our servers
 * except during the normal sign-in request). Sign-out does not clear them, so the form
 * can autofill when the customer returns to log in again.
 */

const REMEMBER_FLAG_KEY = 'snappy_remember_me';
const REMEMBERED_EMAIL_KEY = 'snappy_remembered_email';
const REMEMBERED_PASSWORD_KEY = 'snappy_remembered_password';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function encodeSecret(value: string): string {
  try {
    return btoa(unescape(encodeURIComponent(value)));
  } catch {
    return value;
  }
}

function decodeSecret(value: string): string {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return value;
  }
}

export function getRememberMePreference(): boolean {
  if (!isBrowser()) return true;
  const raw = localStorage.getItem(REMEMBER_FLAG_KEY);
  // Default on so customers stay signed in unless they opt out.
  if (raw === null) return true;
  return raw === '1';
}

export function setRememberMePreference(remember: boolean): void {
  if (!isBrowser()) return;
  localStorage.setItem(REMEMBER_FLAG_KEY, remember ? '1' : '0');

  if (!remember) {
    clearRememberedCredentials();
    // Drop any previously persisted auth so the next write goes to sessionStorage only.
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') && key.includes('auth')) {
        localStorage.removeItem(key);
      }
    }
  }
}

export function getRememberedEmail(): string {
  if (!isBrowser()) return '';
  return localStorage.getItem(REMEMBERED_EMAIL_KEY)?.trim() || '';
}

export function getRememberedPassword(): string {
  if (!isBrowser()) return '';
  const raw = localStorage.getItem(REMEMBERED_PASSWORD_KEY);
  if (!raw) return '';
  return decodeSecret(raw);
}

export function setRememberedCredentials(email: string | null, password: string | null): void {
  if (!isBrowser()) return;
  const trimmedEmail = email?.trim() || '';
  if (trimmedEmail && password) {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, trimmedEmail);
    localStorage.setItem(REMEMBERED_PASSWORD_KEY, encodeSecret(password));
  } else {
    clearRememberedCredentials();
  }
}

/** @deprecated Prefer setRememberedCredentials */
export function setRememberedEmail(email: string | null): void {
  if (!isBrowser()) return;
  const trimmed = email?.trim() || '';
  if (trimmed) {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, trimmed);
  } else {
    clearRememberedCredentials();
  }
}

export function clearRememberedCredentials(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  localStorage.removeItem(REMEMBERED_PASSWORD_KEY);
}

/** Sync auth cookies used by middleware / API cookie fallback. */
export function syncAuthCookies(
  session: { access_token: string; refresh_token: string } | null,
  remember: boolean,
): void {
  if (!isBrowser()) return;

  if (!session) {
    document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax; Secure';
    document.cookie = 'sb-refresh-token=; path=/; max-age=0; SameSite=Lax; Secure';
    return;
  }

  if (remember) {
    document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax; Secure`;
    document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax; Secure`;
  } else {
    // Session cookies: expire when the browser session ends.
    document.cookie = `sb-access-token=${session.access_token}; path=/; SameSite=Lax; Secure`;
    document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; SameSite=Lax; Secure`;
  }
}

export function clearAuthCookies(): void {
  syncAuthCookies(null, false);
}

/**
 * Supabase auth storage that respects Remember me.
 * Reads from both stores so an existing session still loads after toggling preference.
 */
export function createAuthStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
} {
  return {
    getItem(key) {
      if (!isBrowser()) return null;
      return (
        localStorage.getItem(key) ??
        sessionStorage.getItem(key)
      );
    },
    setItem(key, value) {
      if (!isBrowser()) return;
      if (getRememberMePreference()) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    },
    removeItem(key) {
      if (!isBrowser()) return;
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    },
  };
}
