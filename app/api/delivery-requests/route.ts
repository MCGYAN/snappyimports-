import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAdminNotification } from '@/lib/admin-notifications';
import { refreshOrderShippingStage } from '@/lib/shipping-sync';

const PACKAGE_SELECT =
  '*, shipping_package_items(quantity, order_item_id, order_items(id, order_id, product_name, variant_name, orders(order_number, email, shipping_address)))';

async function packageIdsForUser(userId: string) {
  const { data: orders } = await supabaseAdmin.from('orders').select('id').eq('user_id', userId);
  const orderIds = (orders || []).map((order) => order.id);
  if (!orderIds.length) return [];

  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('id')
    .in('order_id', orderIds);
  const itemIds = (items || []).map((item) => item.id);
  if (!itemIds.length) return [];

  const { data: links } = await supabaseAdmin
    .from('shipping_package_items')
    .select('package_id')
    .in('order_item_id', itemIds);
  return [...new Set((links || []).map((link) => link.package_id))];
}

async function orderIdsForPackage(packageId: string) {
  const { data: links } = await supabaseAdmin
    .from('shipping_package_items')
    .select('order_items(order_id)')
    .eq('package_id', packageId);
  return [
    ...new Set(
      (links || [])
        .map((link: any) => link.order_items?.order_id)
        .filter(Boolean),
    ),
  ] as string[];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const adminView = searchParams.get('view') === 'admin';
  const auth = await verifyAuth(req, adminView ? { requireModule: 'orders' } : undefined);
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: auth.error || 'Sign in required.' }, { status: 401 });
  }

  if (adminView) {
    const { data, error } = await supabaseAdmin
      .from('delivery_requests')
      .select(`*, shipping_packages(${PACKAGE_SELECT})`)
      .order('preferred_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) {
      console.error('[delivery requests admin]', error);
      return NextResponse.json({ error: 'Could not load delivery requests.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, requests: data || [] });
  }

  const packageIds = await packageIdsForUser(auth.user.id);
  const [{ data: packages, error: packageError }, { data: requests, error: requestError }] =
    await Promise.all([
      packageIds.length
        ? supabaseAdmin
            .from('shipping_packages')
            .select(PACKAGE_SELECT)
            .in('id', packageIds)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin
        .from('delivery_requests')
        .select('*')
        .eq('customer_user_id', auth.user.id)
        .order('created_at', { ascending: false }),
    ]);
  if (packageError || requestError) {
    console.error('[delivery requests customer]', packageError || requestError);
    return NextResponse.json({ error: 'Could not load delivery scheduling.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    packages: packages || [],
    requests: requests || [],
  });
}

export async function POST(req: Request) {
  const auth = await verifyAuth(req);
  if (!auth.authenticated || !auth.user?.id || !auth.user.email) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const body = await req.json();
  const packageId = String(body.packageId || '').trim();
  const requestType = String(body.requestType || '').trim();
  const preferredDate = String(body.preferredDate || '').trim();
  const preferredTimeWindow = String(body.preferredTimeWindow || '').trim().slice(0, 80);
  const deliveryAddress = String(body.deliveryAddress || '').trim().slice(0, 300);
  const city = String(body.city || '').trim().slice(0, 100);
  const region = String(body.region || '').trim().slice(0, 100);
  const phone = String(body.phone || '').trim().slice(0, 40);
  const notes = String(body.notes || '').trim().slice(0, 500);

  if (!packageId || !['pickup', 'delivery'].includes(requestType) || !preferredDate || !phone) {
    return NextResponse.json(
      { error: 'Package, handoff choice, preferred date, and phone are required.' },
      { status: 400 },
    );
  }
  if (requestType === 'delivery' && (!deliveryAddress || !city || !region)) {
    return NextResponse.json(
      { error: 'Address, city, and region are required for delivery.' },
      { status: 400 },
    );
  }
  const requestedDay = new Date(`${preferredDate}T12:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const latest = new Date(today.getTime() + 90 * 86_400_000);
  if (
    Number.isNaN(requestedDay.getTime()) ||
    requestedDay.getTime() < today.getTime() ||
    requestedDay.getTime() > latest.getTime()
  ) {
    return NextResponse.json(
      { error: 'Choose a date from today through the next 90 days.' },
      { status: 400 },
    );
  }

  const ownedPackageIds = await packageIdsForUser(auth.user.id);
  if (!ownedPackageIds.includes(packageId)) {
    return NextResponse.json({ error: 'Package not found.' }, { status: 404 });
  }
  const { data: pkg } = await supabaseAdmin
    .from('shipping_packages')
    .select('*')
    .eq('id', packageId)
    .single();
  if (!pkg) return NextResponse.json({ error: 'Package not found.' }, { status: 404 });
  if (
    pkg.status !== 'ready' ||
    (!pkg.freight_included && pkg.shipping_payment_status !== 'paid')
  ) {
    return NextResponse.json(
      { error: 'Scheduling opens after the package is ready in Ghana and freight is cleared.' },
      { status: 400 },
    );
  }

  const { data: existing } = await supabaseAdmin
    .from('delivery_requests')
    .select('id, status')
    .eq('shipping_package_id', packageId)
    .maybeSingle();
  if (existing?.status === 'completed') {
    return NextResponse.json({ error: 'This package handoff is already complete.' }, { status: 409 });
  }

  const { data: request, error } = await supabaseAdmin
    .from('delivery_requests')
    .upsert(
      {
        shipping_package_id: packageId,
        customer_user_id: auth.user.id,
        customer_email: auth.user.email.toLowerCase(),
        request_type: requestType,
        preferred_date: preferredDate,
        preferred_time_window: preferredTimeWindow || null,
        delivery_address: requestType === 'delivery' ? deliveryAddress : null,
        city: requestType === 'delivery' ? city : null,
        region: requestType === 'delivery' ? region : null,
        phone,
        notes: notes || null,
        status: 'requested',
        admin_notes: null,
        completed_at: null,
        completed_by: null,
      },
      { onConflict: 'shipping_package_id' },
    )
    .select()
    .single();
  if (error || !request) {
    console.error('[create delivery request]', error);
    return NextResponse.json({ error: 'Could not save your request.' }, { status: 500 });
  }

  await createAdminNotification({
    type: 'delivery_request',
    title: requestType === 'pickup' ? 'Pickup requested' : 'Delivery requested',
    message: `${auth.user.email} chose ${preferredDate} for ${pkg.package_name}.`,
    href: '/admin/deliveries',
    entityId: request.id,
    entityNumber: pkg.tracking_id,
  });
  return NextResponse.json({ success: true, request });
}

export async function PATCH(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const requestId = String(body.requestId || '').trim();
  const status = String(body.status || '').trim();
  const adminNotes = String(body.adminNotes || '').trim().slice(0, 500);
  if (
    !requestId ||
    !['requested', 'contacting', 'confirmed', 'completed', 'cancelled'].includes(status)
  ) {
    return NextResponse.json({ error: 'Request and valid status are required.' }, { status: 400 });
  }

  const { data: current } = await supabaseAdmin
    .from('delivery_requests')
    .select('*')
    .eq('id', requestId)
    .single();
  if (!current) return NextResponse.json({ error: 'Request not found.' }, { status: 404 });

  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('delivery_requests')
    .update({
      status,
      admin_notes: adminNotes || null,
      completed_at: status === 'completed' ? now : null,
      completed_by: status === 'completed' ? auth.user.id : null,
      updated_at: now,
    })
    .eq('id', requestId)
    .select()
    .single();
  if (error || !updated) {
    return NextResponse.json({ error: 'Could not update the request.' }, { status: 500 });
  }

  if (status === 'completed') {
    await supabaseAdmin
      .from('shipping_packages')
      .update({ status: 'delivered', updated_at: now })
      .eq('id', current.shipping_package_id);
    const orderIds = await orderIdsForPackage(current.shipping_package_id);
    await Promise.all(orderIds.map((orderId) => refreshOrderShippingStage(orderId, auth.user?.id)));
  }

  return NextResponse.json({ success: true, request: updated });
}
