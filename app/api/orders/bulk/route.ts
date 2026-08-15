import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  ADMIN_FULFILLMENT_STAGES,
  orderStatusForStage,
  type FulfillmentStage,
} from '@/lib/order-journey';
import { createShopReceipt } from '@/lib/financial-documents';
import { createAdminNotification } from '@/lib/admin-notifications';

export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const action = String(body.action || '');
  const orderIds = [...new Set((Array.isArray(body.orderIds) ? body.orderIds : []).map(String))];
  if (!orderIds.length || orderIds.length > 200) {
    return NextResponse.json({ error: 'Select between 1 and 200 orders.' }, { status: 400 });
  }

  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('*, order_items(*)')
    .in('id', orderIds);
  if (error) return NextResponse.json({ error: 'Could not load selected orders.' }, { status: 500 });

  const completed: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const undoUntil = new Date(Date.now() + 2 * 60_000).toISOString();

  if (action === 'confirm_payment') {
    if (orderIds.length > 50) {
      return NextResponse.json({ error: 'Confirm no more than 50 payments at once.' }, { status: 400 });
    }
    for (const order of orders || []) {
      if (order.payment_status !== 'awaiting_confirmation') {
        skipped.push({ id: order.id, reason: 'Not waiting for confirmation' });
        continue;
      }
      const confirmedAt = new Date().toISOString();
      const { error: paidError } = await supabaseAdmin.rpc('mark_order_paid', {
        order_ref: order.order_number,
        moolre_ref: `MANUAL-BULK-${Date.now()}`,
      });
      if (paidError) {
        skipped.push({ id: order.id, reason: 'Payment update failed' });
        continue;
      }
      const metadata = {
        ...(order.metadata || {}),
        payment_confirmed_at: confirmedAt,
        payment_confirmed_by: auth.user?.id || null,
        payment_channel: order.metadata?.payment_channel || order.payment_method || 'invoice',
        fulfillment_stage: 'paid',
        manual_payment: true,
        stock_reduced: true,
      };
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          payment_provider: 'manual',
          metadata,
          updated_at: confirmedAt,
        })
        .eq('id', order.id)
        .select('*, order_items(*)')
        .single();
      if (updateError || !updated) {
        skipped.push({ id: order.id, reason: 'Could not finish confirmation' });
        continue;
      }
      try {
        await createShopReceipt(updated, auth.user?.id, 2);
      } catch (receiptError) {
        console.error('[bulk orders] receipt queue', receiptError);
      }
      completed.push(order.id);
    }
    if (completed.length) {
      await createAdminNotification({
        type: 'order_paid',
        title: `${completed.length} shop payments confirmed`,
        message: 'Receipts are queued with a 2-minute safety window.',
        href: '/admin/orders',
        entityId: `bulk-${Date.now()}`,
      });
    }
    return NextResponse.json({ success: true, completed, skipped, undoUntil });
  }

  if (action === 'move_stage') {
    const stage = String(body.stage || '') as FulfillmentStage;
    if (!ADMIN_FULFILLMENT_STAGES.includes(stage)) {
      return NextResponse.json({ error: 'Invalid journey stage.' }, { status: 400 });
    }
    const now = new Date().toISOString();
    for (const order of orders || []) {
      if (order.payment_status !== 'paid') {
        skipped.push({ id: order.id, reason: 'Payment is not confirmed' });
        continue;
      }
      const history = Array.isArray(order.metadata?.fulfillment_history)
        ? order.metadata.fulfillment_history
        : [];
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          status: orderStatusForStage(stage),
          metadata: {
            ...(order.metadata || {}),
            fulfillment_stage: stage,
            fulfillment_updated_at: now,
            fulfillment_history: [
              ...history,
              { stage, at: now, by: auth.user?.id || null, source: 'bulk_orders_desk' },
            ],
          },
          updated_at: now,
        })
        .eq('id', order.id);
      if (updateError) skipped.push({ id: order.id, reason: 'Update failed' });
      else completed.push(order.id);
    }
    return NextResponse.json({ success: true, completed, skipped });
  }

  return NextResponse.json({ error: 'Unknown bulk action.' }, { status: 400 });
}
