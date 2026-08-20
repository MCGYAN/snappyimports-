/**
 * Customer "Remember me" preference for storefront auth.
 * Checked: keep session across browser restarts, and autofill email + password on the login form.
 * Unchecked: session ends with the browser tab, and saved login fields are cleared.
 *
 * Credentials stay on-device only (localStorage + cookies with Expires + IndexedDB).
 * Safari often drops max-age-only JS cookies when the browser is fully closed, so we
 * always set an absolute Expires date and keep an IndexedDB backup.
 */

const REMEMBER_FLAG_KEY = 'snappy_remember_me';
const REMEMBERED_EMAIL_KEY = 'snappy_remembered_email';
const REMEMBERED_PASSWORD_KEY = 'snappy_remembered_password';
const CREDENTIAL_MAX_AGE_SEC = 60 * 60 * 24 * 180; // 180 days
const IDB_NAME = 'snappy-remember-login';
const IDB_STORE = 'kv';

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function cookieSecureSuffix(): string {
  return isBrowser() && window.isSecureContext ? '; Secure' : '';
}

function cookieExpiresSuffix(maxAgeSec: number): string {
  const expires = new Date(Date.now() + Math.max(0, maxAgeSec) * 1000).toUTCString();
  return `; expires=${expires}`;
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
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`),
  );
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function writeCookie(name: string, value: string, maxAgeSec: number): void {
  if (!isBrowser()) return;
  // Safari: include both max-age and expires so values survive a full browser quit.
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}${cookieExpiresSuffix(maxAgeSec)}; SameSite=Lax${cookieSecureSuffix()}`;
}

function clearCookie(name: string): void {
  if (!isBrowser()) return;
  document.cookie = `${name}=; path=/; max-age=0${cookieExpiresSuffix(0)}; SameSite=Lax${cookieSecureSuffix()}`;
}

function openRememberDb(): Promise<IDBDatabase | null> {
  if (!isBrowser() || typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openRememberDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => {
        const value = req.result;
        resolve(typeof value === 'string' && value ? value : null);
      };
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    } catch {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openRememberDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      resolve();
    }
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openRememberDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      try {
        db.close();
      } catch {
        /* ignore */
      }
      resolve();
    }
  });
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
  void idbSet(key, value);
}

function removePersisted(key: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
  clearCookie(key);
  void idbDel(key);
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

/**
 * Load remembered login after a full Safari restart.
 * Rehydrates localStorage/cookies from IndexedDB when the browser wiped JS storage.
 */
export async function loadRememberedLogin(): Promise<{
  rememberMe: boolean;
  email: string;
  password: string;
}> {
  if (!isBrowser()) {
    return { rememberMe: true, email: '', password: '' };
  }

  let rememberRaw = readPersisted(REMEMBER_FLAG_KEY);
  let email = readPersisted(REMEMBERED_EMAIL_KEY)?.trim() || '';
  let passwordEnc = readPersisted(REMEMBERED_PASSWORD_KEY) || '';

  if (rememberRaw === null) {
    rememberRaw = (await idbGet(REMEMBER_FLAG_KEY)) || null;
    if (rememberRaw != null) writePersisted(REMEMBER_FLAG_KEY, rememberRaw);
  }
  if (!email) {
    email = ((await idbGet(REMEMBERED_EMAIL_KEY)) || '').trim();
    if (email) writePersisted(REMEMBERED_EMAIL_KEY, email);
  }
  if (!passwordEnc) {
    passwordEnc = (await idbGet(REMEMBERED_PASSWORD_KEY)) || '';
    if (passwordEnc) writePersisted(REMEMBERED_PASSWORD_KEY, passwordEnc);
  }

  const rememberMe = rememberRaw === null ? true : rememberRaw === '1';
  return {
    rememberMe,
    email: rememberMe ? email : '',
    password: rememberMe && passwordEnc ? decodeSecret(passwordEnc) : '',
  };
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
    document.cookie = `sb-access-token=; path=/; max-age=0${cookieExpiresSuffix(0)}; SameSite=Lax${secure}`;
    document.cookie = `sb-refresh-token=; path=/; max-age=0${cookieExpiresSuffix(0)}; SameSite=Lax${secure}`;
    return;
  }

  if (remember) {
    const accessAge = 60 * 60 * 24 * 7;
    const refreshAge = 60 * 60 * 24 * 30;
    document.cookie = `sb-access-token=${encodeURIComponent(session.access_token)}; path=/; max-age=${accessAge}${cookieExpiresSuffix(accessAge)}; SameSite=Lax${secure}`;
    document.cookie = `sb-refresh-token=${encodeURIComponent(session.refresh_token)}; path=/; max-age=${refreshAge}${cookieExpiresSuffix(refreshAge)}; SameSite=Lax${secure}`;
  } else {
    // Session cookies: expire when the browser session ends.
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
