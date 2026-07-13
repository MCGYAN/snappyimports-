import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/** GET /api/orders/lookup?order=&email= — customer invoice / tracking access */
export async function GET(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rate = checkRateLimit(`order-lookup:${clientId}`, RATE_LIMITS.payment);
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const orderNumber = (searchParams.get('order') || '').trim();
    const email = (searchParams.get('email') || '').trim().toLowerCase();

    if (!orderNumber || !email) {
      return NextResponse.json({ error: 'Order number and email are required.' }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('order_number', orderNumber)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if ((order.email || '').toLowerCase() !== email) {
      return NextResponse.json({ error: 'Email does not match this order.' }, { status: 403 });
    }

    return NextResponse.json({ success: true, order });
  } catch (e) {
    console.error('[order lookup]', e);
    return NextResponse.json({ error: 'Failed to load order.' }, { status: 500 });
  }
}
