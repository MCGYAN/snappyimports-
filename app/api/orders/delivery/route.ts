import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { deriveFulfillmentStage, canBookDelivery } from '@/lib/order-journey';

/** POST — customer books last-mile delivery once goods are ready */
export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rate = checkRateLimit(`delivery-book:${clientId}`, RATE_LIMITS.payment);
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const body = await req.json();
    const orderNumber = String(body.orderNumber || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const address = String(body.address || '').trim();
    const city = String(body.city || '').trim();
    const preferredDate = String(body.preferredDate || '').trim();
    const preferredTime = String(body.preferredTime || '').trim();
    const notes = String(body.notes || '').trim().slice(0, 500);

    if (!orderNumber || !email || !address) {
      return NextResponse.json({ error: 'Order, email, and delivery address are required.' }, { status: 400 });
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

    if (order.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment must be confirmed before booking delivery.' }, { status: 400 });
    }

    const stage = deriveFulfillmentStage(order);
    if (!canBookDelivery(stage) && order.status !== 'shipped') {
      return NextResponse.json(
        { error: 'Delivery booking opens when your shipment is nearly ready in Ghana.' },
        { status: 400 },
      );
    }

    const booking = {
      address,
      city,
      preferredDate: preferredDate || null,
      preferredTime: preferredTime || null,
      notes: notes || null,
      bookedAt: new Date().toISOString(),
      status: 'requested' as const,
    };

    // Booking is a note on the order. Do not invent an extra journey stage.
    const metadata = {
      ...(order.metadata || {}),
      delivery_booking: booking,
      fulfillment_stage: order.metadata?.fulfillment_stage || stage,
    };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        shipping_method: 'doorstep',
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select('*, order_items(*)')
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Could not save delivery booking.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: updated, booking });
  } catch (e) {
    console.error('[delivery]', e);
    return NextResponse.json({ error: 'Failed to book delivery.' }, { status: 500 });
  }
}
