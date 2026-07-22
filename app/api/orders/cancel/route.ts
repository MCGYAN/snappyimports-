import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';

const HARD_LOCK = new Set(['shipped', 'delivered']);

/** POST — gated admin cancel. Keeps the order record. Never deletes. */
export async function POST(req: Request) {
  try {
    const auth = await verifyAuth(req, { requireAdmin: true });
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const orderId = String(body.orderId || '').trim();
    const reason = String(body.reason || '').trim().slice(0, 500);
    const confirmText = String(body.confirmText || '').trim().toUpperCase();

    if (!orderId) {
      return NextResponse.json({ error: 'orderId required.' }, { status: 400 });
    }
    if (confirmText !== 'CANCEL') {
      return NextResponse.json(
        { error: 'Type CANCEL to confirm. Accidental cancels are blocked.' },
        { status: 400 },
      );
    }
    if (reason.length < 5) {
      return NextResponse.json({ error: 'Add a short cancel reason (at least 5 characters).' }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (order.status === 'cancelled') {
      return NextResponse.json({ success: true, message: 'Already cancelled.', order });
    }

    if (HARD_LOCK.has(order.status)) {
      return NextResponse.json(
        {
          error: `This order is already ${order.status}. Cancel is locked. Handle as a special case with the customer.`,
        },
        { status: 400 },
      );
    }

    const stage = String(order.metadata?.fulfillment_stage || '');
    if (['en_route_ghana', 'in_ghana', 'ready', 'delivered', 'left_china', 'in_transit', 'in_transit_china', 'arrived_ghana', 'clearing', 'out_for_delivery', 'ready_for_delivery'].includes(stage)) {
      return NextResponse.json(
        { error: 'Import journey is too far along to cancel here. Resolve manually with the customer.' },
        { status: 400 },
      );
    }

    const cancelEntry = {
      at: new Date().toISOString(),
      by: auth.user?.id || null,
      reason,
      previous_status: order.status,
      previous_payment_status: order.payment_status,
      previous_fulfillment_stage: order.metadata?.fulfillment_stage || null,
    };

    const metadata = {
      ...(order.metadata || {}),
      fulfillment_stage: 'cancelled',
      cancelled_at: cancelEntry.at,
      cancel_reason: reason,
      cancel_history: [...(order.metadata?.cancel_history || []), cancelEntry],
    };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'cancelled',
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select('*, order_items(*)')
      .single();

    if (updateError) {
      console.error('[orders/cancel]', updateError);
      return NextResponse.json({ error: 'Failed to cancel order.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (e) {
    console.error('[orders/cancel]', e);
    return NextResponse.json({ error: 'Failed to cancel order.' }, { status: 500 });
  }
}
