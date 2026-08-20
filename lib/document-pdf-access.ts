import { createHmac, timingSafeEqual } from 'crypto';

type PdfAccessPayload = {
  u: string;
  d: string;
  e: number;
};

function signingSecret(): string {
  return (
    process.env.DOCUMENT_PDF_LINK_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    'snappy-document-pdf-dev'
  );
}

function toBase64Url(value: string | Buffer): string {
  const buf = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  return buf.toString('base64url');
}

function signPayload(payloadB64: string): string {
  return createHmac('sha256', signingSecret()).update(payloadB64).digest('base64url');
}

/** Short-lived token so phones can open/share a real HTTPS PDF URL (Chrome + Telegram friendly). */
export function signDocumentPdfAccess(opts: {
  userId: string;
  documentId: string;
  /** Default 15 minutes. */
  ttlMs?: number;
}): string {
  const payload: PdfAccessPayload = {
    u: opts.userId,
    d: opts.documentId,
    e: Date.now() + (opts.ttlMs ?? 15 * 60 * 1000),
  };
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  return `${payloadB64}.${signPayload(payloadB64)}`;
}

export function verifyDocumentPdfAccess(
  token: string | null | undefined,
): { userId: string; documentId: string } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig) return null;

  const expected = signPayload(payloadB64);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const raw = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as PdfAccessPayload;
    if (!parsed?.u || !parsed?.d || !parsed?.e) return null;
    if (Date.now() > Number(parsed.e)) return null;
    return { userId: String(parsed.u), documentId: String(parsed.d) };
  } catch {
    return null;
  }
}
