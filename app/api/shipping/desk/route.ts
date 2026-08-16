import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  calculateCbm,
  calculateShipping,
  createShippingTrackingId,
  rateForClass,
  SHIPPING_GOODS_CLASSES,
  type ShippingGoodsClass,
  type ShippingRateBoard,
} from '@/lib/shipping';
import { createShippingReceipt, issueShippingInvoice } from '@/lib/financial-documents';
import { refreshOrderShippingStage } from '@/lib/shipping-sync';

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

function customerName(order: any) {
  return (
    [order?.shipping_address?.firstName, order?.shipping_address?.lastName]
      .filter(Boolean)
      .join(' ') ||
    order?.email?.split('@')[0] ||
    'Customer'
  );
}

function normalizedEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function itemFreightIncluded(item: any) {
  const importType = String(item?.metadata?.import_type || item?.products?.metadata?.import_type || '');
  return importType === 'cif_tema' || importType === 'ddp';
}

async function loadDeskPackage(id: string) {
  return supabaseAdmin
    .from('shipping_packages')
    .select(
      '*, shipping_package_items(quantity, order_item_id, order_items(id, order_id, product_name, variant_name, quantity, metadata, orders(id, order_number, email, user_id, shipping_address)))',
    )
    .eq('id', id)
    .single();
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
          'id, order_number, email, user_id, shipping_address, payment_status, metadata, order_items(id, product_name, variant_name, quantity, metadata, products(metadata))',
        )
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('shipping_packages')
        .select(
          '*, shipping_package_items(quantity, order_item_id, order_items(id, order_id, product_name, variant_name, quantity, metadata, orders(id, order_number, email, user_id, shipping_address)))',
        )
        .order('created_at', { ascending: false }),
      supabaseAdmin.from('shipping_rate_board').select('*').eq('id', 1).single(),
    ]);

  if (orderError || packageError) {
    console.error('[shipping desk load]', orderError || packageError);
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

  if (action === 'create_package') {
    const requestedItems = (Array.isArray(body.items) ? body.items : [])
      .map((entry: any) => ({
        orderItemId: String(entry.orderItemId || '').trim(),
        quantity: Math.floor(Number(entry.quantity) || 0),
      }))
      .filter((entry: any) => entry.orderItemId && entry.quantity > 0);
    const requestedIds = requestedItems.map((entry: any) => entry.orderItemId);
    if (requestedItems.length === 0 || new Set(requestedIds).size !== requestedIds.length) {
      return NextResponse.json(
        { error: 'Choose at least one item and enter the quantity inside this package.' },
        { status: 400 },
      );
    }

    const { data: selectedRows, error: selectedError } = await supabaseAdmin
      .from('order_items')
      .select('*, products(metadata), orders(id, order_number, email, user_id, shipping_address, payment_status)')
      .in('id', requestedIds);
    if (selectedError || !selectedRows || selectedRows.length !== requestedItems.length) {
      return NextResponse.json({ error: 'One selected order item could not be found.' }, { status: 404 });
    }
    const itemMap = new Map(selectedRows.map((item: any) => [item.id, item]));
    const selectedOrders = selectedRows.map((item: any) => item.orders);
    if (selectedOrders.some((order: any) => order?.payment_status !== 'paid')) {
      return NextResponse.json({ error: 'Only items from paid orders can be packed.' }, { status: 400 });
    }
    const firstOrder = selectedOrders[0];
    const firstEmail = normalizedEmail(firstOrder?.email);
    const userIds = new Set(selectedOrders.map((order: any) => order?.user_id).filter(Boolean));
    const customerUserId = userIds.size === 1 ? String([...userIds][0]) : null;
    const sameSignedInCustomer = userIds.size === 1 && selectedOrders.every((order: any) => order?.user_id);
    const sameGuestCustomer =
      Boolean(firstEmail) &&
      selectedOrders.every((order: any) => normalizedEmail(order?.email) === firstEmail) &&
      userIds.size <= 1;
    if (!sameSignedInCustomer && !sameGuestCustomer) {
      return NextResponse.json(
        { error: 'A package can combine several orders, but they must belong to the same customer.' },
        { status: 400 },
      );
    }

    const { data: allocatedRows } = await supabaseAdmin
      .from('shipping_package_items')
      .select('order_item_id, quantity')
      .in('order_item_id', requestedIds);
    const allocated = new Map<string, number>();
    for (const row of allocatedRows || []) {
      allocated.set(row.order_item_id, (allocated.get(row.order_item_id) || 0) + Number(row.quantity));
    }
    for (const entry of requestedItems) {
      const item: any = itemMap.get(entry.orderItemId);
      const remaining = Number(item.quantity) - (allocated.get(entry.orderItemId) || 0);
      if (entry.quantity > remaining) {
        return NextResponse.json(
          {
            error: `${item.product_name} has only ${Math.max(0, remaining)} unpacked item${
              remaining === 1 ? '' : 's'
            } left.`,
          },
          { status: 409 },
        );
      }
    }

    const selectedItems = requestedItems.map((entry: any) => itemMap.get(entry.orderItemId));
    const terms = new Set(selectedItems.map(itemFreightIncluded));
    if (terms.size > 1) {
      return NextResponse.json(
        {
          error:
            'Items with freight included cannot share a package with items that need a CBM bill. Create separate packages.',
        },
        { status: 400 },
      );
    }
    const freightIncluded = terms.has(true);
    const goodsClass = SHIPPING_GOODS_CLASSES.includes(body.goodsClass)
      ? (body.goodsClass as ShippingGoodsClass)
      : 'normal';
    const lengthM = Number(body.lengthM) || 0;
    const widthM = Number(body.widthM) || 0;
    const heightM = Number(body.heightM) || 0;
    const enteredCbm = Number(body.cbm) || 0;
    const cbm =
      lengthM > 0 && widthM > 0 && heightM > 0
        ? calculateCbm(lengthM, widthM, heightM, 1)
        : Number(enteredCbm.toFixed(4));
    if (!(cbm > 0)) {
      return NextResponse.json({ error: 'Enter the package dimensions or total CBM.' }, { status: 400 });
    }

    const customRate = Math.max(0, Number(body.customUsdPerCbm) || 0);
    const usdPerCbm = freightIncluded
      ? 0
      : goodsClass === 'custom'
        ? customRate
        : rateForClass(board, goodsClass);
    if (!freightIncluded && !(usdPerCbm > 0)) {
      return NextResponse.json({ error: 'Enter a valid shipping rate.' }, { status: 400 });
    }
    const estimate = calculateShipping(cbm, usdPerCbm, board.usd_to_ghs);
    const { count } = await supabaseAdmin
      .from('shipping_packages')
      .select('id', { count: 'exact', head: true })
      .eq(
        sameSignedInCustomer ? 'customer_user_id' : 'customer_email',
        sameSignedInCustomer ? firstOrder.user_id : firstEmail,
      );
    const trackingId = createShippingTrackingId();
    const packageName =
      String(body.packageName || '').trim().slice(0, 120) ||
      `${customerName(firstOrder)} Package ${Number(count || 0) + 1}`;
    const receivedAt = body.receivedAt
      ? new Date(body.receivedAt).toISOString()
      : new Date().toISOString();

    const { data: pkg, error } = await supabaseAdmin
      .from('shipping_packages')
      .insert({
        order_id: firstOrder.id,
        order_item_id: requestedItems[0].orderItemId,
        customer_user_id: customerUserId,
        customer_email: firstEmail,
        tracking_id: trackingId,
        package_name: packageName,
        goods_class: goodsClass,
        quantity: 1,
        length_m: lengthM || null,
        width_m: widthM || null,
        height_m: heightM || null,
        cbm,
        usd_per_cbm: usdPerCbm,
        estimated_shipping_usd: estimate.shippingUsd,
        estimate_usd_to_ghs: board.usd_to_ghs || null,
        estimated_shipping_ghs: estimate.shippingGhs,
        freight_included: freightIncluded,
        status: 'received',
        warehouse_received_at: receivedAt,
        carrier_reference: String(body.carrierReference || '').trim().slice(0, 120) || null,
        notes: String(body.notes || '').trim().slice(0, 500) || null,
        created_by: auth.user?.id || null,
      })
      .select()
      .single();
    if (error || !pkg) {
      console.error('[create shipping package]', error);
      return NextResponse.json({ error: 'Could not create the package.' }, { status: 500 });
    }

    const { error: contentError } = await supabaseAdmin.rpc('replace_shipping_package_items', {
      p_package_id: pkg.id,
      p_items: requestedItems.map((entry: any) => ({
        order_item_id: entry.orderItemId,
        quantity: entry.quantity,
      })),
    });
    if (contentError) {
      await supabaseAdmin.from('shipping_packages').delete().eq('id', pkg.id);
      console.error('[create package contents]', contentError);
      return NextResponse.json({ error: 'Could not save the items inside this package.' }, { status: 500 });
    }
    const affectedOrderIds = [...new Set(selectedRows.map((item: any) => item.order_id))];
    await Promise.all(affectedOrderIds.map((id) => refreshOrderShippingStage(id, auth.user?.id)));
    const { data: complete } = await loadDeskPackage(pkg.id);
    return NextResponse.json({ success: true, package: complete || pkg });
  }

  const packageIds = [...new Set((Array.isArray(body.packageIds) ? body.packageIds : []).map(String))];
  if (!packageIds.length || packageIds.length > 200) {
    return NextResponse.json({ error: 'Select between 1 and 200 packages.' }, { status: 400 });
  }
  const { data: packages } = await supabaseAdmin
    .from('shipping_packages')
    .select(
      '*, shipping_package_items(order_item_id, order_items(order_id, orders(id, order_number, email, user_id, shipping_address)))',
    )
    .in('id', packageIds);
  const orderIds = [
    ...new Set(
      (packages || []).flatMap((pkg: any) =>
        (pkg.shipping_package_items || [])
          .map((entry: any) => entry.order_items?.order_id)
          .filter(Boolean),
      ),
    ),
  ];

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
    await Promise.all(orderIds.map((id) => refreshOrderShippingStage(id, auth.user?.id)));
    return NextResponse.json({ success: true, updated: packageIds.length });
  }

  if (action === 'lock_arrival') {
    const finalRate = Number(body.finalUsdToGhs);
    const validDays = Math.min(
      30,
      Math.max(1, Math.round(Number(body.validDays) || board.invoice_valid_days)),
    );
    if (!(finalRate > 0)) {
      return NextResponse.json({ error: 'Enter the arrival day USD to GHS rate.' }, { status: 400 });
    }
    let issued = 0;
    let included = 0;
    for (const pkg of packages || []) {
      await supabaseAdmin
        .from('shipping_packages')
        .update({ status: 'arrived', arrived_at: new Date().toISOString() })
        .eq('id', pkg.id);
      const invoice = await issueShippingInvoice({
        pkg,
        finalUsdToGhs: finalRate,
        validDays,
        createdBy: auth.user?.id,
      });
      if (invoice) issued++;
      else included++;
    }
    await Promise.all(orderIds.map((id) => refreshOrderShippingStage(id, auth.user?.id)));
    return NextResponse.json({ success: true, issued, included });
  }

  if (action === 'mark_ready' || action === 'mark_delivered') {
    const status = action === 'mark_ready' ? 'ready' : 'delivered';
    const eligibleIds =
      status === 'ready'
        ? (packages || [])
            .filter(
              (pkg: any) =>
                ['arrived', 'clearing'].includes(pkg.status) &&
                (pkg.freight_included || pkg.shipping_payment_status === 'paid'),
            )
            .map((pkg: any) => pkg.id)
        : packageIds;
    if (!eligibleIds.length) {
      return NextResponse.json(
        {
          error:
            status === 'ready'
              ? 'Only packages that are in Ghana with freight cleared can be marked ready.'
              : 'Select packages to update.',
        },
        { status: 400 },
      );
    }
    const { error } = await supabaseAdmin
      .from('shipping_packages')
      .update({ status, updated_at: new Date().toISOString() })
      .in('id', eligibleIds);
    if (error) return NextResponse.json({ error: 'Could not update packages.' }, { status: 500 });
    await Promise.all(orderIds.map((id) => refreshOrderShippingStage(id, auth.user?.id)));
    return NextResponse.json({ success: true, updated: eligibleIds.length });
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
        await createShippingReceipt(pkg, auth.user?.id, 2);
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
      if (['ready', 'delivered'].includes(pkg.status)) continue;
      const { count: openRequests } = await supabaseAdmin
        .from('delivery_requests')
        .select('id', { count: 'exact', head: true })
        .eq('shipping_package_id', pkg.id)
        .neq('status', 'cancelled');
      if (openRequests) continue;
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
