import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyAuth } from '@/lib/auth';
import {
  createExchangeNumber,
  EXCHANGE_DUE_HOURS,
  isRateValid,
  quoteGhsToRmb,
} from '@/lib/rmb-exchange';
import { createPaymentReference } from '@/lib/payment-reference';

/** POST — create exchange request (invoice only) */
export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimit = checkRateLimit(`exchange:${clientId}`, RATE_LIMITS.payment);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const body = await req.json();
    const customerName = String(body.customerName || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim() || null;
    const businessName = String(body.businessName || '').trim() || null;
    const direction = 'ghs_to_rmb' as const;
    const amountInput = Number(body.amount);

    if (!customerName || !phone) {
      return NextResponse.json({ error: 'Name and phone are required.' }, { status: 400 });
    }
    if (!Number.isFinite(amountInput) || amountInput <= 0) {
      return NextResponse.json({ error: 'Enter a valid amount in cedis.' }, { status: 400 });
    }

    const { data: board } = await supabaseAdmin
      .from('exchange_rate_board')
      .select('*')
      .eq('id', 1)
      .single();

    if (!board || !isRateValid(board)) {
      return NextResponse.json(
        { error: 'Today’s RMB buy rate is not available or has expired. Contact Snappy on WhatsApp.' },
        { status: 400 },
      );
    }

    const quote = quoteGhsToRmb(amountInput, Number(board.buy_rmb_rate));

    const ghsSide = quote.amountFrom;
    if (ghsSide < Number(board.min_amount_ghs || 0)) {
      return NextResponse.json(
        { error: `Minimum buy is GH¢${Number(board.min_amount_ghs).toFixed(0)}.` },
        { status: 400 },
      );
    }
    if (board.max_amount_ghs && ghsSide > Number(board.max_amount_ghs)) {
      return NextResponse.json(
        { error: `Maximum buy is GH¢${Number(board.max_amount_ghs).toFixed(0)}.` },
        { status: 400 },
      );
    }

    const exchangeNumber = createExchangeNumber();
    const paymentRef = createPaymentReference('SN');
    const dueAt = new Date(Date.now() + EXCHANGE_DUE_HOURS * 3600000).toISOString();

    const { data, error } = await supabaseAdmin
      .from('exchange_orders')
      .insert({
        exchange_number: exchangeNumber,
        customer_name: customerName,
        phone,
        email,
        business_name: businessName,
        direction,
        rate: quote.rate,
        amount_from: quote.amountFrom,
        amount_to: quote.amountTo,
        currency_from: quote.currencyFrom,
        currency_to: quote.currencyTo,
        status: 'awaiting_payment',
        payment_status: 'pending',
        due_at: dueAt,
        metadata: {
          rate_board_updated_at: board.updated_at,
          payment_ref: paymentRef,
        },
      })
      .select()
      .single();

    if (error) {
      console.error('[exchange create]', error);
      return NextResponse.json({ error: 'Could not create exchange order.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, exchange: data });
  } catch (e) {
    console.error('[exchange create]', e);
    return NextResponse.json({ error: 'Failed to create exchange.' }, { status: 500 });
  }
}

/** GET — lookup by exchange number + phone (customer) or list (admin) */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const exchangeNumber = (searchParams.get('exchange') || '').trim();
  const phone = (searchParams.get('phone') || '').trim();
  const admin = searchParams.get('admin') === '1';

  if (admin) {
    const auth = await verifyAuth(req, { requireAdmin: true });
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }
    const { data, error } = await supabaseAdmin
      .from('exchange_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, exchanges: data });
  }

  if (!exchangeNumber || !phone) {
    return NextResponse.json({ error: 'Exchange number and phone required.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('exchange_orders')
    .select('*')
    .eq('exchange_number', exchangeNumber)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Exchange not found.' }, { status: 404 });
  }

  const digits = (s: string) => s.replace(/\D/g, '');
  if (!digits(data.phone).endsWith(digits(phone).slice(-9))) {
    return NextResponse.json({ error: 'Phone does not match this exchange.' }, { status: 403 });
  }

  return NextResponse.json({ success: true, exchange: data });
}
