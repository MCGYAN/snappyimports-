import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyAuth } from '@/lib/auth';
import {
  createExchangeNumber,
  EXCHANGE_DUE_HOURS,
} from '@/lib/rmb-exchange';
import { createPaymentReference } from '@/lib/payment-reference';
import {
  corridorIsReady,
  EXCHANGE_CORRIDORS,
  formatLocalMoney,
  normalizePayAccounts,
  parseExchangeCountryCode,
  quoteLocalToRmb,
  resolvePayAccounts,
  type CorridorRateBoard,
  type ExchangeCountryCode,
} from '@/lib/exchange-corridors';

const ALIPAY_BUCKET = 'exchange-alipay';
const ALLOWED_QR = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function sanitizeExchange(row: any) {
  if (!row) return row;
  const { alipay_qr_path, ...rest } = row;
  return {
    ...rest,
    has_alipay_qr: Boolean(alipay_qr_path),
  };
}

function mapBoard(row: any): CorridorRateBoard {
  const country = parseExchangeCountryCode(row.country_code);
  return {
    country_code: country,
    currency_code: row.currency_code || EXCHANGE_CORRIDORS[country].currencyCode,
    buy_rmb_rate: Number(row.buy_rmb_rate) || 0,
    sell_rmb_rate: Number(row.sell_rmb_rate) || 0,
    min_amount: Number(row.min_amount) || 0,
    max_amount: row.max_amount != null ? Number(row.max_amount) : null,
    notes: row.notes || null,
    valid_until: row.valid_until || null,
    is_live: Boolean(row.is_live),
    pay_accounts: normalizePayAccounts(row.pay_accounts),
    updated_at: row.updated_at,
  };
}

async function readCreatePayload(req: Request): Promise<{
  country: ExchangeCountryCode;
  customerName: string;
  phone: string;
  email: string | null;
  businessName: string | null;
  amountInput: number;
  alipayAccountName: string | null;
  alipayFile: File | null;
}> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('alipayQr');
    return {
      country: parseExchangeCountryCode(form.get('country')),
      customerName: String(form.get('customerName') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      email: String(form.get('email') || '').trim() || null,
      businessName: String(form.get('businessName') || '').trim() || null,
      amountInput: Number(form.get('amount')),
      alipayAccountName: String(form.get('alipayAccountName') || '').trim() || null,
      alipayFile: file instanceof File ? file : null,
    };
  }

  const body = await req.json();
  return {
    country: parseExchangeCountryCode(body.country),
    customerName: String(body.customerName || '').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim() || null,
    businessName: String(body.businessName || '').trim() || null,
    amountInput: Number(body.amount),
    alipayAccountName: String(body.alipayAccountName || '').trim() || null,
    alipayFile: null,
  };
}

/** POST — create exchange request (invoice + Alipay receive QR) */
export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimit = checkRateLimit(`exchange:${clientId}`, RATE_LIMITS.payment);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const payload = await readCreatePayload(req);
    let { country, customerName, phone, email, businessName, amountInput, alipayAccountName, alipayFile } =
      payload;

    const auth = await verifyAuth(req);
    const userId = auth.authenticated && auth.user?.id ? (auth.user.id as string) : null;
    if (userId && !email && auth.user?.email) {
      email = String(auth.user.email).trim().toLowerCase();
    } else if (email) {
      email = email.toLowerCase();
    }

    const meta = EXCHANGE_CORRIDORS[country];

    if (!customerName || !phone) {
      return NextResponse.json({ error: 'Name and phone are required.' }, { status: 400 });
    }
    if (!Number.isFinite(amountInput) || amountInput <= 0) {
      return NextResponse.json(
        { error: `Enter a valid amount in ${meta.currencyLabel}.` },
        { status: 400 },
      );
    }
    if (!alipayFile) {
      return NextResponse.json(
        {
          error:
            'Upload your Alipay receive QR screenshot. Open Alipay, open receive money, screenshot, then upload.',
        },
        { status: 400 },
      );
    }
    if (!ALLOWED_QR.has(alipayFile.type)) {
      return NextResponse.json(
        { error: 'Alipay QR must be a JPG, PNG, or WebP image.' },
        { status: 400 },
      );
    }
    if (alipayFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Alipay QR image must be under 5MB.' }, { status: 400 });
    }

    const { data: boardRow, error: boardError } = await supabaseAdmin
      .from('exchange_corridor_rates')
      .select('*')
      .eq('country_code', country)
      .maybeSingle();

    if (boardError) {
      console.error('[exchange create] board', boardError);
      return NextResponse.json({ error: 'Could not load rate board.' }, { status: 500 });
    }

    const board = boardRow ? mapBoard(boardRow) : null;
    const ready = corridorIsReady(board);
    if (!ready.ok || !board) {
      return NextResponse.json(
        { error: ready.ok === false ? ready.reason : 'Corridor not ready.' },
        { status: 400 },
      );
    }

    const quote = quoteLocalToRmb(amountInput, Number(board.buy_rmb_rate), country);
    const localSide = quote.amountFrom;

    if (localSide < Number(board.min_amount || 0)) {
      return NextResponse.json(
        {
          error: `Minimum buy for ${meta.name} is ${formatLocalMoney(Number(board.min_amount), country, 0)}.`,
        },
        { status: 400 },
      );
    }
    if (board.max_amount && localSide > Number(board.max_amount)) {
      return NextResponse.json(
        {
          error: `Maximum buy for ${meta.name} is ${formatLocalMoney(Number(board.max_amount), country, 0)}.`,
        },
        { status: 400 },
      );
    }

    const payAccounts = resolvePayAccounts(board);
    const exchangeNumber = createExchangeNumber();
    const paymentRef = createPaymentReference('SN');
    const dueAt = new Date(Date.now() + EXCHANGE_DUE_HOURS * 3600000).toISOString();

    const ext =
      alipayFile.type.includes('png') ? 'png' : alipayFile.type.includes('webp') ? 'webp' : 'jpg';
    const qrPath = `${exchangeNumber}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await alipayFile.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(ALIPAY_BUCKET)
      .upload(qrPath, buffer, {
        contentType: alipayFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[exchange create] alipay upload', uploadError);
      return NextResponse.json(
        { error: 'Could not save your Alipay QR. Try another screenshot.' },
        { status: 500 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('exchange_orders')
      .insert({
        exchange_number: exchangeNumber,
        customer_name: customerName,
        phone,
        email,
        business_name: businessName,
        user_id: userId,
        country_code: country,
        direction: quote.direction,
        rate: quote.rate,
        amount_from: quote.amountFrom,
        amount_to: quote.amountTo,
        currency_from: quote.currencyFrom,
        currency_to: quote.currencyTo,
        status: 'awaiting_payment',
        payment_status: 'pending',
        due_at: dueAt,
        alipay_qr_path: qrPath,
        alipay_account_name: alipayAccountName,
        metadata: {
          country_code: country,
          country_name: meta.name,
          rate_board_updated_at: board.updated_at,
          payment_ref: paymentRef,
          guest_checkout: !userId,
          alipay_qr_uploaded_at: new Date().toISOString(),
          // Freeze pay-in accounts on the invoice so later admin edits cannot rewrite history
          pay_accounts: payAccounts,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('[exchange create]', error);
      await supabaseAdmin.storage.from(ALIPAY_BUCKET).remove([qrPath]);
      return NextResponse.json({ error: 'Could not create exchange order.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, exchange: sanitizeExchange(data) });
  } catch (e) {
    console.error('[exchange create]', e);
    return NextResponse.json({ error: 'Failed to create exchange.' }, { status: 500 });
  }
}

/** GET — lookup by exchange number + phone, owner session, or admin list */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const exchangeNumber = (searchParams.get('exchange') || '').trim();
  const phone = (searchParams.get('phone') || '').trim();
  const admin = searchParams.get('admin') === '1';
  const countryFilter = searchParams.get('country');

  if (admin) {
    const auth = await verifyAuth(req, { requireModule: 'exchange' });
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }
    let query = supabaseAdmin
      .from('exchange_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (countryFilter && countryFilter !== 'ALL') {
      query = query.eq('country_code', parseExchangeCountryCode(countryFilter));
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      success: true,
      exchanges: (data || []).map(sanitizeExchange),
    });
  }

  if (!exchangeNumber) {
    return NextResponse.json({ error: 'Exchange number required.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('exchange_orders')
    .select('*')
    .eq('exchange_number', exchangeNumber)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Exchange not found.' }, { status: 404 });
  }

  const auth = await verifyAuth(req);
  const isOwner =
    auth.authenticated &&
    data.user_id &&
    auth.user?.id &&
    data.user_id === auth.user.id;

  const staffAuth = await verifyAuth(req, { requireModule: 'exchange' });
  if (staffAuth.authenticated) {
    return NextResponse.json({ success: true, exchange: sanitizeExchange(data), adminView: true });
  }

  if (isOwner) {
    return NextResponse.json({ success: true, exchange: sanitizeExchange(data) });
  }

  if (!phone) {
    return NextResponse.json(
      { error: 'Sign in or provide the phone used on this invoice.' },
      { status: 400 },
    );
  }

  const digits = (s: string) => s.replace(/\D/g, '');
  if (!digits(data.phone).endsWith(digits(phone).slice(-9))) {
    return NextResponse.json({ error: 'Phone does not match this exchange.' }, { status: 403 });
  }

  return NextResponse.json({ success: true, exchange: sanitizeExchange(data) });
}
