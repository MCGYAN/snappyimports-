import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';

/** POST — admin confirms bank/MoMo payment received */
export async function POST(req: Request) {
  try {
    const auth = await verifyAuth(req, { requireAdmin: true });
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const orderId = String(body.orderId || '').trim();
    const orderNumber = String(body.orderNumber || '').trim();
    const adminNote = String(body.note || '').trim().slice(0, 500);

    if (!orderId && !orderNumber) {
      return NextResponse.json({ error: 'orderId or orderNumber required.' }, { status: 400 });
    }

    let query = supabaseAdmin.from('orders').select('*');
    query = orderId ? query.eq('id', orderId) : query.eq('order_number', orderNumber);
    const { data: order, error } = await query.single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({ success: true, message: 'Already paid.', order });
    }

    // Prefer RPC for stock reduction + paid status
    const { error: rpcError } = await supabaseAdmin.rpc('mark_order_paid', {
      order_ref: order.order_number,
      moolre_ref: `MANUAL-${Date.now()}`,
    });

    const metadata = {
      ...(order.metadata || {}),
      payment_confirmed_at: new Date().toISOString(),
      payment_confirmed_by: auth.user?.id || null,
      payment_confirm_note: adminNote || null,
      payment_channel: order.metadata?.payment_channel || order.payment_method || 'invoice',
      fulfillment_stage: 'paid',
      manual_payment: true,
    };

    if (rpcError) {
      console.warn('[confirm-payment] RPC failed, falling back to update:', rpcError.message);
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'processing',
          payment_provider: 'manual',
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .select('*, order_items(*)')
        .single();

      if (updateError) {
        return NextResponse.json({ error: 'Failed to confirm payment.' }, { status: 500 });
      }
      return NextResponse.json({ success: true, order: updated });
    }

    const { data: updated } = await supabaseAdmin
      .from('orders')
      .update({
        payment_provider: 'manual',
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select('*, order_items(*)')
      .single();

    return NextResponse.json({ success: true, order: updated });
  } catch (e) {
    console.error('[confirm-payment]', e);
    return NextResponse.json({ error: 'Failed to confirm payment.' }, { status: 500 });
  }
}
