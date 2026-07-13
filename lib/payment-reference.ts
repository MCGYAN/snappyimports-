/** Short optional transfer codes. Easier than long ORD-… numbers on MoMo/bank notes. */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function createPaymentReference(prefix = 'SN'): string {
  let body = '';
  for (let i = 0; i < 4; i++) {
    body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}-${body}`;
}

/** Stable short code for older invoices that never stored one. */
export function paymentRefFromSeed(seed: string, prefix = 'SN'): string {
  let hash = 0;
  const s = String(seed || 'snappy');
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  let body = '';
  for (let i = 0; i < 4; i++) {
    body += ALPHABET[hash % ALPHABET.length];
    hash = Math.floor(hash / ALPHABET.length) || (hash * 7 + i + 1);
  }
  return `${prefix}-${body}`;
}

export function resolvePaymentReference(
  stored: string | null | undefined,
  seed: string,
  prefix = 'SN',
): string {
  const clean = String(stored || '').trim().toUpperCase();
  if (/^[A-Z]{2}-[A-Z0-9]{4}$/.test(clean)) return clean;
  return paymentRefFromSeed(seed, prefix);
}
