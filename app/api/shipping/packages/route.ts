import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import { type ShippingRateBoard } from '@/lib/shipping';
import { issueShippingInvoice } from '@/lib/financial-documents';

function mapRateBoard(row: any): ShippingRateBoard {
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

async function loadOrder(orderId?: string, orderNumber?: string) {
  let query = supabaseAdmin
    .from('orders')
    .select('*, order_items(*, products(metadata))');
  query = orderId ? query.eq('id', orderId) : query.eq('order_number', orderNumber || '');
  return query.single();
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

  const itemIds = (order.order_items || []).map((item: any) => item.id);
  const { data: links } = itemIds.length
    ? await supabaseAdmin
        .from('shipping_package_items')
        .select('package_id')
        .in('order_item_id', itemIds)
    : { data: [] };
  const linkedPackageIds = [...new Set((links || []).map((link) => link.package_id))];
  const [{ data: packages, error }, { data: rateRow }] = await Promise.all([
    linkedPackageIds.length
      ? supabaseAdmin
          .from('shipping_packages')
          .select(
            '*, shipping_package_items(quantity, order_item_id, order_items(id, order_id, product_name, variant_name, quantity, metadata, orders(order_number)))',
          )
          .in('id', linkedPackageIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from('shipping_rate_board').select('*').eq('id', 1).single(),
  ]);
  if (error) {
    console.error('[shipping packages]', error);
    return NextResponse.json({ error: 'Could not load shipping details.' }, { status: 500 });
  }

  const packageIds = (packages || []).map((pkg) => pkg.id);
  const { data: documents } = packageIds.length
    ? await supabaseAdmin
        .from('financial_documents')
        .select('*')
        .in('shipping_package_id', packageIds)
        .neq('status', 'void')
        .order('issued_at', { ascending: false })
    : { data: [] };

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
    documents: documents || [],
    board: rateRow ? mapRateBoard(rateRow) : null,
    adminView: auth.authenticated,
  });
}

export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  if (String(body.action || '') !== 'lock_rate') {
    return NextResponse.json(
      { error: 'Create and update packages from the Packages workspace.' },
      { status: 400 },
    );
  }

  const orderId = String(body.orderId || '').trim();
  const packageId = String(body.packageId || '').trim();
  const finalRate = Number(body.finalUsdToGhs);
  if (!orderId || !packageId || !(finalRate > 0)) {
    return NextResponse.json(
      { error: 'Order, package and arrival day rate are required.' },
      { status: 400 },
    );
  }

  const [{ data: order }, { data: pkg }, { data: rateRow }] = await Promise.all([
    loadOrder(orderId).then((result) => result),
    supabaseAdmin
      .from('shipping_packages')
      .select('*')
      .eq('id', packageId)
      .single(),
    supabaseAdmin.from('shipping_rate_board').select('*').eq('id', 1).single(),
  ]);
  if (!order || !pkg || !rateRow) {
    return NextResponse.json({ error: 'Package not found.' }, { status: 404 });
  }
  const orderItemIds = (order.order_items || []).map((item: any) => item.id);
  const { count: membershipCount } = orderItemIds.length
    ? await supabaseAdmin
        .from('shipping_package_items')
        .select('id', { count: 'exact', head: true })
        .eq('package_id', packageId)
        .in('order_item_id', orderItemIds)
    : { count: 0 };
  if (!membershipCount) {
    return NextResponse.json({ error: 'Package is not linked to this order.' }, { status: 404 });
  }

  const invoice = await issueShippingInvoice({
    pkg,
    finalUsdToGhs: finalRate,
    validDays: mapRateBoard(rateRow).invoice_valid_days,
    createdBy: auth.user?.id,
  });
  return NextResponse.json({ success: true, invoice });
}
