// Google reCAPTCHA v3 utilities
// Client-side: executeRecaptcha() to get a token (loads script on demand)
// Server-side: verifyRecaptcha() to validate the token

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY || '';

// Minimum score to pass verification (0.0 = bot, 1.0 = human)
const MIN_SCORE = 0.5;

let recaptchaScriptPromise: Promise<void> | null = null;

/** Load the reCAPTCHA script only when a form actually needs it (not on every page). */
export function ensureRecaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!RECAPTCHA_SITE_KEY) return Promise.resolve();

  const w = window as Window & { grecaptcha?: { ready: (cb: () => void) => void } };
  if (w.grecaptcha?.ready) return Promise.resolve();
  if (recaptchaScriptPromise) return recaptchaScriptPromise;

  recaptchaScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-snappy-recaptcha]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('reCAPTCHA script failed')), {
        once: true,
      });
      if (w.grecaptcha?.ready) resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.dataset.snappyRecaptcha = '1';
    script.onload = () => resolve();
    script.onerror = () => {
      recaptchaScriptPromise = null;
      reject(new Error('reCAPTCHA script failed to load'));
    };
    document.head.appendChild(script);
  });

  return recaptchaScriptPromise;
}

/**
 * Client-side: Execute reCAPTCHA v3 and return a token.
 * Loads the Google script on first use (checkout, login, contact, etc.).
 */
export async function executeRecaptcha(action: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (!RECAPTCHA_SITE_KEY) {
    console.warn('[reCAPTCHA] NEXT_PUBLIC_RECAPTCHA_SITE_KEY not configured');
    return null;
  }

  try {
    await ensureRecaptchaScript();

    return await new Promise<string>((resolve, reject) => {
      const w = window as any;
      if (!w.grecaptcha) {
        reject(new Error('reCAPTCHA script not loaded'));
        return;
      }
      w.grecaptcha.ready(() => {
        w.grecaptcha
          .execute(RECAPTCHA_SITE_KEY, { action })
          .then(resolve)
          .catch((err: unknown) =>
            reject(err instanceof Error ? err : new Error('reCAPTCHA failed')),
          );
      });
    });
  } catch (error) {
    console.error('[reCAPTCHA] Execute error:', error);
    return null;
  }
}

/**
 * Server-side: Verify a reCAPTCHA token with Google.
 * Returns { success, score, action } or { success: false, error }.
 */
export async function verifyRecaptcha(
  token: string,
  expectedAction?: string,
): Promise<{ success: boolean; score?: number; error?: string }> {
  if (!RECAPTCHA_SECRET_KEY) {
    console.warn('[reCAPTCHA] RECAPTCHA_SECRET_KEY not configured — skipping verification');
    return { success: true, score: 1.0 };
  }

  if (!token) {
    return { success: false, error: 'No reCAPTCHA token provided' };
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: RECAPTCHA_SECRET_KEY,
        response: token,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return { success: false, error: 'reCAPTCHA verification failed', score: data.score };
    }

    if (expectedAction && data.action !== expectedAction) {
      return { success: false, error: 'reCAPTCHA action mismatch', score: data.score };
    }

    if (data.score < MIN_SCORE) {
      console.warn(`[reCAPTCHA] Low score: ${data.score} for action: ${data.action}`);
      return { success: false, error: 'reCAPTCHA score too low', score: data.score };
    }

    return { success: true, score: data.score };
  } catch (error: any) {
    console.error('[reCAPTCHA] Verification error:', error.message);
    return { success: false, error: 'reCAPTCHA verification request failed' };
  }
}
