import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

const BUCKET = 'exchange-alipay';
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function phoneMatches(stored: string, provided: string) {
  const digits = (s: string) => s.replace(/\D/g, '');
  const a = digits(stored);
  const b = digits(provided);
  if (!a || !b) return false;
  return a.endsWith(b.slice(-9)) || b.endsWith(a.slice(-9));
}

async function authorizeExchangeAccess(req: Request, exchange: { user_id?: string | null; phone?: string | null }) {
  const auth = await verifyAuth(req, { requireModule: 'exchange' });
  if (auth.authenticated) {
    return { ok: true as const, role: 'admin' as const };
  }

  const ownerAuth = await verifyAuth(req);
  if (
    ownerAuth.authenticated &&
    exchange.user_id &&
    ownerAuth.user?.id &&
    exchange.user_id === ownerAuth.user.id
  ) {
    return { ok: true as const, role: 'owner' as const };
  }

  const { searchParams } = new URL(req.url);
  const phone = (searchParams.get('phone') || '').trim();
  if (phone && exchange.phone && phoneMatches(exchange.phone, phone)) {
    return { ok: true as const, role: 'phone' as const };
  }

  return { ok: false as const, error: 'Unauthorized' };
}

/** GET — signed URL for Alipay QR (admin, order owner, or matching phone) */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const exchangeNumber = (searchParams.get('exchange') || '').trim();
    if (!exchangeNumber) {
      return NextResponse.json({ error: 'Exchange number required.' }, { status: 400 });
    }

    const { data: exchange, error } = await supabaseAdmin
      .from('exchange_orders')
      .select('id, exchange_number, phone, user_id, alipay_qr_path, alipay_account_name, customer_name, amount_to')
      .eq('exchange_number', exchangeNumber)
      .single();

    if (error || !exchange) {
      return NextResponse.json({ error: 'Exchange not found.' }, { status: 404 });
    }

    const access = await authorizeExchangeAccess(req, exchange);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: 401 });
    }

    if (!exchange.alipay_qr_path) {
      return NextResponse.json({ error: 'No Alipay QR on this request.' }, { status: 404 });
    }

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(exchange.alipay_qr_path, 60 * 10);

    if (signError || !signed?.signedUrl) {
      console.error('[alipay-qr] sign', signError);
      return NextResponse.json({ error: 'Could not open Alipay QR.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: signed.signedUrl,
      alipayAccountName: exchange.alipay_account_name,
      customerName: exchange.customer_name,
      amountTo: exchange.amount_to,
      expiresInSeconds: 600,
    });
  } catch (e) {
    console.error('[alipay-qr GET]', e);
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  }
}

/** POST — replace/upload Alipay QR on an existing exchange (customer phone or admin) */
export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rate = checkRateLimit(`alipay-qr:${clientId}`, RATE_LIMITS.payment);
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const form = await req.formData();
    const exchangeNumber = String(form.get('exchangeNumber') || '').trim();
    const phone = String(form.get('phone') || '').trim();
    const alipayAccountName = String(form.get('alipayAccountName') || '').trim() || null;
    const file = form.get('alipayQr');

    if (!exchangeNumber) {
      return NextResponse.json({ error: 'Exchange number required.' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Alipay QR image is required.' }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: 'Upload a JPG, PNG, or WebP screenshot of your Alipay receive QR.' },
        { status: 400 },
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be under 5MB.' }, { status: 400 });
    }

    const { data: exchange, error } = await supabaseAdmin
      .from('exchange_orders')
      .select('*')
      .eq('exchange_number', exchangeNumber)
      .single();

    if (error || !exchange) {
      return NextResponse.json({ error: 'Exchange not found.' }, { status: 404 });
    }

    // Attach phone for customer auth path
    const reqForAuth = new Request(req.url.includes('?') ? `${req.url}&phone=${encodeURIComponent(phone)}` : `${req.url}?phone=${encodeURIComponent(phone)}`, {
      headers: req.headers,
    });
    const access = await authorizeExchangeAccess(reqForAuth, exchange);
    if (!access.ok) {
      // Also allow plain phone match from form body
      if (!(phone && exchange.phone && phoneMatches(exchange.phone, phone))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    if (['completed', 'expired'].includes(exchange.status)) {
      return NextResponse.json({ error: 'This request can no longer change Alipay details.' }, { status: 400 });
    }

    const ext =
      file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg';
    const path = `${exchange.exchange_number}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      console.error('[alipay-qr] upload', uploadError);
      return NextResponse.json({ error: 'Could not save Alipay QR.' }, { status: 500 });
    }

    if (exchange.alipay_qr_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([exchange.alipay_qr_path]);
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('exchange_orders')
      .update({
        alipay_qr_path: path,
        alipay_account_name: alipayAccountName || exchange.alipay_account_name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', exchange.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Could not update exchange.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, exchange: sanitizeExchange(updated) });
  } catch (e) {
    console.error('[alipay-qr POST]', e);
    return NextResponse.json({ error: 'Failed to upload Alipay QR.' }, { status: 500 });
  }
}

function sanitizeExchange(row: any) {
  if (!row) return row;
  const { alipay_qr_path, ...rest } = row;
  return {
    ...rest,
    has_alipay_qr: Boolean(alipay_qr_path),
  };
}
