import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyAuth } from '@/lib/auth';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/orders/pay-context?order=<uuid|order_number>
 * Secure payment-page loader (service role). Does not list guest orders publicly.
 * Owners / staff get the order; others need a hard-to-guess id/number + rate limits.
 */
export async function GET(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rate = checkRateLimit(`order-pay-context:${clientId}`, RATE_LIMITS.payment);
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const orderKey = (searchParams.get('order') || '').trim();
    if (!orderKey) {
      return NextResponse.json({ error: 'Order id is required.' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('orders')
      .select(
        'id, order_number, email, phone, status, payment_status, currency, subtotal, tax_total, shipping_total, discount_total, total, shipping_method, payment_method, shipping_address, billing_address, metadata, created_at, user_id',
      );

    if (UUID_RE.test(orderKey)) {
      query = query.or(`id.eq.${orderKey},order_number.eq.${orderKey}`);
    } else {
      query = query.eq('order_number', orderKey);
    }

    const { data: order, error } = await query.maybeSingle();
    if (error || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const auth = await verifyAuth(req);
    const isOwner =
      auth.authenticated &&
      order.user_id &&
      auth.user?.id &&
      order.user_id === auth.user.id;

    // Guests / owners may open pay link by exact id or order number (not enumerable via RLS).
    // Strip user_id before returning.
    const { user_id: _uid, ...safeOrder } = order as any;

    return NextResponse.json({
      success: true,
      order: safeOrder,
      owned: Boolean(isOwner),
    });
  } catch (e) {
    console.error('[orders/pay-context]', e);
    return NextResponse.json({ error: 'Failed to load order.' }, { status: 500 });
  }
}
