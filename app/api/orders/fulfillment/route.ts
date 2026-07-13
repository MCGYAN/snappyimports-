import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import {
  FULFILLMENT_STAGES,
  orderStatusForStage,
  type FulfillmentStage,
} from '@/lib/order-journey';

/** POST — admin updates China→Ghana fulfillment stage */
export async function POST(req: Request) {
  try {
    const auth = await verifyAuth(req, { requireAdmin: true });
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const orderId = String(body.orderId || '').trim();
    const stage = String(body.stage || '').trim() as FulfillmentStage;
    const note = String(body.note || '').trim().slice(0, 500);

    if (!orderId || !FULFILLMENT_STAGES.some((s) => s.key === stage)) {
      return NextResponse.json({ error: 'Valid orderId and stage required.' }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    const history = Array.isArray(order.metadata?.fulfillment_history)
      ? order.metadata.fulfillment_history
      : [];
    history.push({
      stage,
      note: note || null,
      at: new Date().toISOString(),
      by: auth.user?.id || null,
    });

    const metadata = {
      ...(order.metadata || {}),
      fulfillment_stage: stage,
      fulfillment_history: history,
      fulfillment_updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: orderStatusForStage(stage),
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select('*, order_items(*)')
      .single();

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update journey.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (e) {
    console.error('[fulfillment]', e);
    return NextResponse.json({ error: 'Failed to update fulfillment.' }, { status: 500 });
  }
}
