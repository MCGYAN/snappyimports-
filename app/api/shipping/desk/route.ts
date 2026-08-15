import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  calculateShipping,
  createShippingTrackingId,
  rateForClass,
  SHIPPING_GOODS_CLASSES,
  type ShippingGoodsClass,
  type ShippingRateBoard,
} from '@/lib/shipping';
import { createShippingReceipt, issueShippingInvoice } from '@/lib/financial-documents';

function boardFrom(row: any): ShippingRateBoard {
  return {
    id: 1,
    usd_to_ghs: Number(row?.usd_to_ghs) || 0,
    normal_usd_per_cbm: Number(row?.normal_usd_per_cbm) || 0,
    sensitive_usd_per_cbm: Number(row?.sensitive_usd_per_cbm) || 0,
    heavy_usd_per_cbm: Number(row?.heavy_usd_per_cbm) || 0,
    bulk_usd_per_cbm: Number(row?.bulk_usd_per_cbm) || 0,
    default_transit_days: Number(row?.default_transit_days) || 45,
    invoice_valid_days: Number(row?.invoice_valid_days) || 5,
    notes: row?.notes || null,
    updated_at: row?.updated_at,
  };
}

async function advanceOrders(packageRows: any[], stage: string, status: string, actorId?: string) {
  const orderIds = [...new Set(packageRows.map((pkg) => pkg.order_id))];
  for (const orderId of orderIds) {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, metadata')
      .eq('id', orderId)
      .single();
    if (!order) continue;
    const history = Array.isArray(order.metadata?.fulfillment_history)
      ? order.metadata.fulfillment_history
      : [];
    const now = new Date().toISOString();
    await supabaseAdmin
      .from('orders')
      .update({
        status,
        metadata: {
          ...(order.metadata || {}),
          fulfillment_stage: stage,
          fulfillment_updated_at: now,
          fulfillment_history: [
            ...history,
            { stage, at: now, by: actorId || null, source: 'shipping_desk' },
          ],
        },
        updated_at: now,
      })
      .eq('id', orderId);
  }
}

export async function GET(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  const [{ data: orders, error: orderError }, { data: packages, error: packageError }, { data: rateRow }] =
    await Promise.all([
      supabaseAdmin
        .from('orders')
        .select(
          'id, order_number, email, user_id, shipping_address, payment_status, metadata, order_items(id, product_name, quantity, metadata, products(metadata))',
        )
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('shipping_packages')
        .select('*, orders(order_number, email, user_id, shipping_address), order_items(product_name)')
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('shipping_rate_board').select('*').eq('id', 1).single(),
    ]);
  if (orderError || packageError) {
    return NextResponse.json({ error: 'Could not load shipping desk.' }, { status: 500 });
  }
  return NextResponse.json({
    success: true,
    orders: orders || [],
    packages: packages || [],
    board: rateRow ? boardFrom(rateRow) : null,
  });
}

export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const action = String(body.action || '');
  const { data: rateRow } = await supabaseAdmin
    .from('shipping_rate_board')
    .select('*')
    .eq('id', 1)
    .single();
  if (!rateRow) return NextResponse.json({ error: 'Set shipping rates first.' }, { status: 400 });
  const board = boardFrom(rateRow);

  if (action === 'measure') {
    const orderId = String(body.orderId || '');
    const orderItemId = String(body.orderItemId || '');
    const cbm = Number(body.cbm);
    if (!orderId || !orderItemId || !(cbm > 0)) {
      return NextResponse.json({ error: 'Order item and CBM are required.' }, { status: 400 });
    }
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, products(metadata))')
      .eq('id', orderId)
      .eq('payment_status', 'paid')
      .single();
    const item = order?.order_items?.find((row: any) => row.id === orderItemId);
    if (!order || !item) return NextResponse.json({ error: 'Paid order item not found.' }, { status: 404 });

    const { data: existing } = await supabaseAdmin
      .from('shipping_packages')
      .select('id')
      .eq('order_item_id', orderItemId)
      .limit(1)
      .maybeSingle();
    if (existing) return NextResponse.json({ error: 'This item already has a package.' }, { status: 409 });

    const goodsClass = SHIPPING_GOODS_CLASSES.includes(body.goodsClass)
      ? (body.goodsClass as ShippingGoodsClass)
      : 'normal';
    const importType = String(item.metadata?.import_type || item.products?.metadata?.import_type || '');
    const freightIncluded = importType === 'cif_tema' || importType === 'ddp';
    const rate = freightIncluded ? 0 : rateForClass(board, goodsClass);
    const estimate = calculateShipping(cbm, rate, board.usd_to_ghs);
    const { data: pkg, error } = await supabaseAdmin
      .from('shipping_packages')
      .insert({
        order_id: order.id,
        order_item_id: item.id,
        tracking_id: createShippingTrackingId(),
        package_name: item.product_name,
        goods_class: goodsClass,
        quantity: Number(item.quantity) || 1,
        cbm: Number(cbm.toFixed(4)),
        usd_per_cbm: rate,
        estimated_shipping_usd: estimate.shippingUsd,
        estimate_usd_to_ghs: board.usd_to_ghs || null,
        estimated_shipping_ghs: estimate.shippingGhs,
        freight_included: freightIncluded,
        status: 'received',
        warehouse_received_at: body.receivedAt
          ? new Date(body.receivedAt).toISOString()
          : new Date().toISOString(),
        created_by: auth.user?.id || null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: 'Could not create package.' }, { status: 500 });
    return NextResponse.json({ success: true, package: pkg });
  }

  const packageIds = [...new Set((Array.isArray(body.packageIds) ? body.packageIds : []).map(String))];
  if (!packageIds.length || packageIds.length > 200) {
    return NextResponse.json({ error: 'Select between 1 and 200 packages.' }, { status: 400 });
  }
  const { data: packages } = await supabaseAdmin
    .from('shipping_packages')
    .select('*, orders(*)')
    .in('id', packageIds);

  if (action === 'mark_in_transit') {
    const loadedAt = body.loadedAt ? new Date(body.loadedAt) : new Date();
    const transitDays = Math.min(
      180,
      Math.max(1, Math.round(Number(body.transitDays) || board.default_transit_days)),
    );
    const eta = new Date(loadedAt.getTime() + transitDays * 86_400_000).toISOString();
    const { error } = await supabaseAdmin
      .from('shipping_packages')
      .update({
        status: 'in_transit',
        loaded_at: loadedAt.toISOString(),
        estimated_arrival_at: eta,
        vessel: String(body.vessel || '').trim().slice(0, 120) || null,
        updated_at: new Date().toISOString(),
      })
      .in('id', packageIds);
    if (error) return NextResponse.json({ error: 'Could not move packages.' }, { status: 500 });
    await advanceOrders(packages || [], 'en_route_ghana', 'shipped', auth.user?.id);
    return NextResponse.json({ success: true, updated: packageIds.length });
  }

  if (action === 'lock_arrival') {
    const finalRate = Number(body.finalUsdToGhs);
    const validDays = Math.min(
      30,
      Math.max(1, Math.round(Number(body.validDays) || board.invoice_valid_days)),
    );
    if (!(finalRate > 0)) {
      return NextResponse.json({ error: 'Enter the arrival-day USD to GHS rate.' }, { status: 400 });
    }
    let issued = 0;
    for (const pkg of packages || []) {
      await supabaseAdmin
        .from('shipping_packages')
        .update({ status: 'arrived', arrived_at: new Date().toISOString() })
        .eq('id', pkg.id);
      await issueShippingInvoice({
        pkg,
        order: pkg.orders,
        finalUsdToGhs: finalRate,
        validDays,
        createdBy: auth.user?.id,
      });
      issued++;
    }
    await advanceOrders(packages || [], 'in_ghana', 'shipped', auth.user?.id);
    return NextResponse.json({ success: true, issued });
  }

  if (action === 'confirm_shipping_payment') {
    let confirmed = 0;
    for (const pkg of packages || []) {
      if (pkg.shipping_payment_status !== 'awaiting_confirmation') continue;
      const now = new Date().toISOString();
      await supabaseAdmin
        .from('shipping_packages')
        .update({
          shipping_payment_status: 'paid',
          shipping_paid_at: now,
          shipping_payment_confirmed_by: auth.user?.id || null,
        })
        .eq('id', pkg.id);
      try {
        await createShippingReceipt(pkg, pkg.orders, auth.user?.id, 2);
      } catch (receiptError) {
        console.error('[shipping desk] receipt queue', receiptError);
      }
      confirmed++;
    }
    return NextResponse.json({
      success: true,
      confirmed,
      undoUntil: new Date(Date.now() + 2 * 60_000).toISOString(),
    });
  }

  if (action === 'undo_shipping_payment') {
    let undone = 0;
    for (const pkg of packages || []) {
      const paidAt = pkg.shipping_paid_at ? new Date(pkg.shipping_paid_at).getTime() : 0;
      if (pkg.shipping_payment_status !== 'paid' || !paidAt || Date.now() - paidAt > 2 * 60_000) {
        continue;
      }
      const now = new Date().toISOString();
      await Promise.all([
        supabaseAdmin
          .from('shipping_packages')
          .update({
            shipping_payment_status: 'awaiting_confirmation',
            shipping_paid_at: null,
            shipping_payment_confirmed_by: null,
            updated_at: now,
          })
          .eq('id', pkg.id),
        supabaseAdmin
          .from('financial_documents')
          .update({ status: 'void', updated_at: now })
          .eq('flow', 'shipping')
          .eq('entity_id', pkg.id)
          .eq('document_type', 'receipt')
          .neq('status', 'void'),
        supabaseAdmin
          .from('financial_documents')
          .update({ status: 'active', paid_at: null, updated_at: now })
          .eq('flow', 'shipping')
          .eq('entity_id', pkg.id)
          .eq('document_type', 'invoice')
          .eq('status', 'paid'),
        supabaseAdmin
          .from('notification_outbox')
          .update({ status: 'cancelled', updated_at: now })
          .eq('event_key', `shipping-receipt:${pkg.id}`)
          .eq('status', 'pending'),
      ]);
      undone++;
    }
    return NextResponse.json({ success: true, undone });
  }

  return NextResponse.json({ error: 'Unknown shipping action.' }, { status: 400 });
}
