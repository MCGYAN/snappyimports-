import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import {
  calculateCbm,
  calculateShipping,
  createShippingTrackingId,
  rateForClass,
  SHIPPING_GOODS_CLASSES,
  SHIPPING_STATUS,
  type ShippingGoodsClass,
  type ShippingPackageStatus,
  type ShippingRateBoard,
} from '@/lib/shipping';
import {
  deriveFulfillmentStage,
  fulfillmentIndex,
  orderStatusForStage,
  type FulfillmentStage,
} from '@/lib/order-journey';

function mapRateBoard(row: any): ShippingRateBoard {
  return {
    id: 1,
    usd_to_ghs: Number(row?.usd_to_ghs) || 0,
    normal_usd_per_cbm: Number(row?.normal_usd_per_cbm) || 0,
    sensitive_usd_per_cbm: Number(row?.sensitive_usd_per_cbm) || 0,
    heavy_usd_per_cbm: Number(row?.heavy_usd_per_cbm) || 0,
    bulk_usd_per_cbm: Number(row?.bulk_usd_per_cbm) || 0,
    default_transit_days: Number(row?.default_transit_days) || 45,
    notes: row?.notes || null,
    updated_at: row?.updated_at,
  };
}

async function loadOrder(orderId?: string, orderNumber?: string) {
  let query = supabaseAdmin
    .from('orders')
    .select('*, order_items(*, products(metadata))');
  query = orderId ? query.eq('id', orderId) : query.eq('order_number', orderNumber || '');
  return query.single();
}

function stageForPackage(status: ShippingPackageStatus): FulfillmentStage | null {
  if (status === 'in_transit' || status === 'loaded') return 'en_route_ghana';
  if (status === 'arrived' || status === 'clearing') return 'in_ghana';
  if (status === 'ready') return 'ready';
  if (status === 'delivered') return 'delivered';
  return null;
}

async function syncOrderJourney(order: any, packageStatus: ShippingPackageStatus) {
  const nextStage = stageForPackage(packageStatus);
  if (!nextStage) return;
  const currentStage = deriveFulfillmentStage(order);
  if (fulfillmentIndex(nextStage) <= fulfillmentIndex(currentStage)) return;

  const now = new Date().toISOString();
  const history = Array.isArray(order.metadata?.fulfillment_history)
    ? order.metadata.fulfillment_history
    : [];
  await supabaseAdmin
    .from('orders')
    .update({
      status: orderStatusForStage(nextStage),
      metadata: {
        ...(order.metadata || {}),
        fulfillment_stage: nextStage,
        fulfillment_updated_at: now,
        fulfillment_history: [...history, { stage: nextStage, at: now, source: 'shipping_package' }],
      },
      updated_at: now,
    })
    .eq('id', order.id);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = String(searchParams.get('orderId') || '').trim();
  const orderNumber = String(searchParams.get('order') || '').trim();
  const email = String(searchParams.get('email') || '').trim().toLowerCase();

  if (!orderId && !orderNumber) {
    return NextResponse.json({ error: 'Order required.' }, { status: 400 });
  }

  const { data: order, error: orderError } = await loadOrder(orderId, orderNumber);
  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated && (!email || String(order.email || '').toLowerCase() !== email)) {
    return NextResponse.json({ error: 'Email does not match this order.' }, { status: 403 });
  }

  const [{ data: packages, error }, { data: rateRow }] = await Promise.all([
    supabaseAdmin
      .from('shipping_packages')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('shipping_rate_board').select('*').eq('id', 1).single(),
  ]);

  if (error) {
    return NextResponse.json({ error: 'Could not load shipping details.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    order: {
      id: order.id,
      order_number: order.order_number,
      email: order.email,
      payment_status: order.payment_status,
      status: order.status,
      metadata: order.metadata,
      order_items: order.order_items,
    },
    packages: packages || [],
    board: rateRow ? mapRateBoard(rateRow) : null,
    adminView: auth.authenticated,
  });
}

export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const orderId = String(body.orderId || '').trim();
    const packageId = String(body.packageId || '').trim();
    if (!orderId) {
      return NextResponse.json({ error: 'Order required.' }, { status: 400 });
    }

    const { data: order, error: orderError } = await loadOrder(orderId);
    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }
    if (order.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Confirm the product payment before creating a shipment.' },
        { status: 400 },
      );
    }

    const { data: rateRow, error: rateError } = await supabaseAdmin
      .from('shipping_rate_board')
      .select('*')
      .eq('id', 1)
      .single();
    if (rateError || !rateRow) {
      return NextResponse.json({ error: 'Set shipping rates first.' }, { status: 400 });
    }
    const board = mapRateBoard(rateRow);

    const goodsClass = SHIPPING_GOODS_CLASSES.includes(body.goodsClass)
      ? (body.goodsClass as ShippingGoodsClass)
      : 'normal';
    const status = SHIPPING_STATUS.includes(body.status)
      ? (body.status as ShippingPackageStatus)
      : 'received';
    const orderItemId = String(body.orderItemId || '').trim() || null;
    const orderItem = orderItemId
      ? order.order_items?.find((item: any) => item.id === orderItemId)
      : null;
    if (orderItemId && !orderItem) {
      return NextResponse.json({ error: 'Order item not found.' }, { status: 400 });
    }

    const importType = String(
      orderItem?.metadata?.import_type || orderItem?.products?.metadata?.import_type || '',
    );
    const freightIncluded =
      Boolean(body.freightIncluded) || importType === 'cif_tema' || importType === 'ddp';
    const quantity = Math.max(1, Math.round(Number(body.quantity) || 1));
    const lengthM = Number(body.lengthM) || 0;
    const widthM = Number(body.widthM) || 0;
    const heightM = Number(body.heightM) || 0;
    const measuredCbm = Number(body.cbm) || 0;
    const cbm =
      lengthM > 0 && widthM > 0 && heightM > 0
        ? calculateCbm(lengthM, widthM, heightM, quantity)
        : Number(measuredCbm.toFixed(4));
    if (!(cbm > 0)) {
      return NextResponse.json({ error: 'Enter the measured CBM or package dimensions.' }, { status: 400 });
    }

    const classRate =
      goodsClass === 'custom'
        ? Math.max(0, Number(body.customUsdPerCbm) || 0)
        : rateForClass(board, goodsClass);
    const usdPerCbm = freightIncluded ? 0 : classRate;
    const estimate = calculateShipping(cbm, usdPerCbm, board.usd_to_ghs);

    const loadedAt = body.loadedAt ? new Date(body.loadedAt).toISOString() : null;
    const transitDays = Math.min(
      180,
      Math.max(1, Math.round(Number(body.transitDays) || board.default_transit_days)),
    );
    const estimatedArrivalAt = body.estimatedArrivalAt
      ? new Date(body.estimatedArrivalAt).toISOString()
      : loadedAt
        ? new Date(new Date(loadedAt).getTime() + transitDays * 86_400_000).toISOString()
        : null;
    const arrivedAt =
      body.arrivedAt
        ? new Date(body.arrivedAt).toISOString()
        : status === 'arrived' || status === 'clearing' || status === 'ready' || status === 'delivered'
          ? new Date().toISOString()
          : null;
    const finalUsdToGhs = Number(body.finalUsdToGhs) || null;
    const finalShippingGhs =
      freightIncluded || !finalUsdToGhs
        ? freightIncluded
          ? 0
          : null
        : calculateShipping(cbm, usdPerCbm, finalUsdToGhs).shippingGhs;

    const payload = {
      order_id: order.id,
      order_item_id: orderItemId,
      package_name: String(body.packageName || orderItem?.product_name || 'Shipment')
        .trim()
        .slice(0, 200),
      goods_class: goodsClass,
      quantity,
      length_m: lengthM || null,
      width_m: widthM || null,
      height_m: heightM || null,
      cbm,
      usd_per_cbm: usdPerCbm,
      estimated_shipping_usd: estimate.shippingUsd,
      estimate_usd_to_ghs: board.usd_to_ghs || null,
      estimated_shipping_ghs: estimate.shippingGhs,
      freight_included: freightIncluded,
      status,
      warehouse_received_at: body.warehouseReceivedAt
        ? new Date(body.warehouseReceivedAt).toISOString()
        : null,
      loaded_at: loadedAt,
      estimated_arrival_at: estimatedArrivalAt,
      arrived_at: arrivedAt,
      vessel: String(body.vessel || '').trim().slice(0, 120) || null,
      final_usd_to_ghs: finalUsdToGhs,
      final_shipping_ghs: finalShippingGhs,
      notes: String(body.notes || '').trim().slice(0, 500) || null,
      updated_at: new Date().toISOString(),
    };

    let result;
    if (packageId) {
      result = await supabaseAdmin
        .from('shipping_packages')
        .update(payload)
        .eq('id', packageId)
        .eq('order_id', order.id)
        .select()
        .single();
    } else {
      result = await supabaseAdmin
        .from('shipping_packages')
        .insert({
          ...payload,
          tracking_id: createShippingTrackingId(),
          created_by: auth.user?.id || null,
        })
        .select()
        .single();
    }

    if (result.error || !result.data) {
      console.error('[shipping package]', result.error);
      return NextResponse.json({ error: 'Could not save shipment.' }, { status: 500 });
    }

    await syncOrderJourney(order, status);
    return NextResponse.json({ success: true, package: result.data });
  } catch (error) {
    console.error('[shipping package]', error);
    return NextResponse.json({ error: 'Could not save shipment.' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ error: 'Package required.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('shipping_packages').delete().eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not delete package.' }, { status: 500 });
  return NextResponse.json({ success: true });
}
