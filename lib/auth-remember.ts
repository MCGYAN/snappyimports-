/**
 * Customer "Remember me" preference for storefront auth.
 * Checked: keep session across browser restarts, and autofill email + password on the login form.
 * Unchecked: session ends with the browser tab, and saved login fields are cleared.
 *
 * Credentials are stored on-device only (localStorage + first-party cookies).
 * Cookies are required for Safari / iOS, where localStorage is unreliable and
 * password fields often reject values set only through React state.
 */

const REMEMBER_FLAG_KEY = 'snappy_remember_me';
const REMEMBERED_EMAIL_KEY = 'snappy_remembered_email';
const REMEMBERED_PASSWORD_KEY = 'snappy_remembered_password';
const CREDENTIAL_MAX_AGE_SEC = 60 * 60 * 24 * 180; // 180 days

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function cookieSecureSuffix(): string {
  return isBrowser() && window.isSecureContext ? '; Secure' : '';
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

function readCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function writeCookie(name: string, value: string, maxAgeSec: number): void {
  if (!isBrowser()) return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax${cookieSecureSuffix()}`;
}

function clearCookie(name: string): void {
  if (!isBrowser()) return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${cookieSecureSuffix()}`;
}

/** Prefer localStorage; fall back to cookie (Safari / private mode). */
function readPersisted(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    const fromLs = localStorage.getItem(key);
    if (fromLs != null && fromLs !== '') return fromLs;
  } catch {
    /* private mode / blocked */
  }
  return readCookie(key);
}

function writePersisted(key: string, value: string, maxAgeSec = CREDENTIAL_MAX_AGE_SEC): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / blocked */
  }
  writeCookie(key, value, maxAgeSec);
}

function removePersisted(key: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  clearCookie(key);
}

export function getRememberMePreference(): boolean {
  if (!isBrowser()) return true;
  const raw = readPersisted(REMEMBER_FLAG_KEY);
  // Default on so customers stay signed in unless they opt out.
  if (raw === null) return true;
  return raw === '1';
}

export function setRememberMePreference(remember: boolean): void {
  if (!isBrowser()) return;
  writePersisted(REMEMBER_FLAG_KEY, remember ? '1' : '0');

  if (!remember) {
    clearRememberedCredentials();
    // Drop any previously persisted auth so the next write goes to sessionStorage only.
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('sb-') && key.includes('auth')) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      /* ignore */
    }
  }
}

export function getRememberedEmail(): string {
  return readPersisted(REMEMBERED_EMAIL_KEY)?.trim() || '';
}

export function getRememberedPassword(): string {
  const raw = readPersisted(REMEMBERED_PASSWORD_KEY);
  if (!raw) return '';
  return decodeSecret(raw);
}

export function setRememberedCredentials(email: string | null, password: string | null): void {
  if (!isBrowser()) return;
  const trimmedEmail = email?.trim() || '';
  if (trimmedEmail && password) {
    writePersisted(REMEMBERED_EMAIL_KEY, trimmedEmail);
    writePersisted(REMEMBERED_PASSWORD_KEY, encodeSecret(password));
  } else {
    clearRememberedCredentials();
  }
}

/** @deprecated Prefer setRememberedCredentials */
export function setRememberedEmail(email: string | null): void {
  if (!isBrowser()) return;
  const trimmed = email?.trim() || '';
  if (trimmed) {
    writePersisted(REMEMBERED_EMAIL_KEY, trimmed);
  } else {
    clearRememberedCredentials();
  }
}

export function clearRememberedCredentials(): void {
  removePersisted(REMEMBERED_EMAIL_KEY);
  removePersisted(REMEMBERED_PASSWORD_KEY);
}

/**
 * Safari often clears or ignores password values set only via React controlled state.
 * Temporarily switch to type=text, write the DOM value, then restore password type.
 */
export function applySafariSafePassword(
  input: HTMLInputElement | null,
  password: string,
): void {
  if (!input || !password) return;
  const prevType = input.type;
  try {
    input.type = 'text';
    input.value = password;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.type = prevType || 'password';
  } catch {
    input.value = password;
    input.type = prevType || 'password';
  }
}

/** Sync auth cookies used by middleware / API cookie fallback. */
export function syncAuthCookies(
  session: { access_token: string; refresh_token: string } | null,
  remember: boolean,
): void {
  if (!isBrowser()) return;
  const secure = cookieSecureSuffix();

  if (!session) {
    document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax${secure}`;
    document.cookie = `sb-refresh-token=; path=/; max-age=0; SameSite=Lax${secure}`;
    return;
  }

  // Prefer refresh token for longevity; access token may exceed Safari's ~4KB cookie cap.
  if (remember) {
    document.cookie = `sb-access-token=${encodeURIComponent(session.access_token)}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`;
    document.cookie = `sb-refresh-token=${encodeURIComponent(session.refresh_token)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`;
  } else {
    document.cookie = `sb-access-token=${encodeURIComponent(session.access_token)}; path=/; SameSite=Lax${secure}`;
    document.cookie = `sb-refresh-token=${encodeURIComponent(session.refresh_token)}; path=/; SameSite=Lax${secure}`;
  }
}

export function clearAuthCookies(): void {
  syncAuthCookies(null, false);
}

export function getAuthCookies(): { access_token: string; refresh_token: string } | null {
  const access_token = readCookie('sb-access-token') || '';
  const refresh_token = readCookie('sb-refresh-token') || '';
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

/**
 * Supabase auth storage that respects Remember me.
 * Dual-writes to cookies when possible so Safari can restore after localStorage wipe.
 * Full session JSON may exceed cookie size; localStorage remains primary for that blob.
 */
export function createAuthStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
} {
  return {
    getItem(key) {
      if (!isBrowser()) return null;
      try {
        const ls = localStorage.getItem(key);
        if (ls) return ls;
      } catch {
        /* ignore */
      }
      try {
        const ss = sessionStorage.getItem(key);
        if (ss) return ss;
      } catch {
        /* ignore */
      }
      return readCookie(key);
    },
    setItem(key, value) {
      if (!isBrowser()) return;
      if (getRememberMePreference()) {
        try {
          localStorage.setItem(key, value);
        } catch {
          /* ignore */
        }
        try {
          sessionStorage.removeItem(key);
        } catch {
          /* ignore */
        }
        // Only cookie-mirror if it fits Safari's limit (~4096 incl. name/attrs).
        if (key.length + value.length < 3500) {
          writeCookie(key, value, 60 * 60 * 24 * 30);
        }
      } else {
        try {
          sessionStorage.setItem(key, value);
        } catch {
          /* ignore */
        }
        try {
          localStorage.removeItem(key);
        } catch {
          /* ignore */
        }
        clearCookie(key);
      }
    },
    removeItem(key) {
      if (!isBrowser()) return;
      try {
        localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      try {
        sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      clearCookie(key);
    },
  };
}
