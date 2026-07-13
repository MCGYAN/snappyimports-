import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { isInvoiceExpired } from '@/lib/payment-routing';

/** POST — customer marks bank/MoMo payment as sent */
export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rate = checkRateLimit(`payment-sent:${clientId}`, RATE_LIMITS.payment);
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const body = await req.json();
    const orderNumber = String(body.orderNumber || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const note = String(body.note || '').trim().slice(0, 500);

    if (!orderNumber || !email) {
      return NextResponse.json({ error: 'Order number and email are required.' }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if ((order.email || '').toLowerCase() !== email) {
      return NextResponse.json({ error: 'Email does not match this order.' }, { status: 403 });
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ success: true, message: 'Already paid.', order });
    }

    const dueAt = order.metadata?.invoice_due_at;
    if (isInvoiceExpired(dueAt)) {
      return NextResponse.json(
        { error: 'This invoice has expired. Contact us on WhatsApp to renew it.' },
        { status: 400 },
      );
    }

    const metadata = {
      ...(order.metadata || {}),
      payment_sent_at: new Date().toISOString(),
      payment_sent_note: note || null,
      fulfillment_stage: 'payment_sent',
    };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        payment_status: 'awaiting_confirmation',
        status: 'awaiting_payment',
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select('*, order_items(*)')
      .single();

    if (updateError) {
      console.error('[payment-sent]', updateError);
      return NextResponse.json({ error: 'Could not update order.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Thanks. We will confirm your payment shortly.',
      order: updated,
    });
  } catch (e) {
    console.error('[payment-sent]', e);
    return NextResponse.json({ error: 'Failed to submit payment notice.' }, { status: 500 });
  }
}
