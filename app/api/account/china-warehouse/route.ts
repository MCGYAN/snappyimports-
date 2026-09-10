import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

function clean(value: unknown, max: number): string {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeTracking(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase();
}

export async function GET(req: Request) {
  const auth = await verifyAuth(req);
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const [{ data: profile, error: profileError }, { data: warehouse }, { data: inbound, error: inboundError }] =
    await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('shipping_mark, full_name, phone')
        .eq('id', auth.user.id)
        .single(),
      supabaseAdmin
        .from('china_warehouse_settings')
        .select(
          'warehouse_name, contact_name, phone, address_chinese, entry_numbers, ghana_tracking_phone, tracking_whatsapp, instructions, updated_at',
        )
        .eq('id', 1)
        .eq('is_active', true)
        .maybeSingle(),
      supabaseAdmin
        .from('inbound_packages')
        .select(
          'id, supplier_tracking_number, supplier_name, description, cartons, cbm, goods_class, status, received_at, loaded_at, estimated_arrival_at, vessel, notes, shipping_package_id, created_at',
        )
        .eq('customer_user_id', auth.user.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false }),
    ]);

  if (profileError || inboundError) {
    console.error('[china warehouse account]', profileError || inboundError);
    return NextResponse.json({ error: 'Could not load warehouse details.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    shippingMark: profile?.shipping_mark || null,
    traderName: profile?.full_name || auth.user.user_metadata?.full_name || null,
    traderPhone:
      profile?.phone ||
      auth.user.user_metadata?.phone ||
      auth.user.phone ||
      null,
    warehouse: warehouse || null,
    inboundPackages: inbound || [],
  });
}

export async function POST(req: Request) {
  const auth = await verifyAuth(req);
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }
  const rate = checkRateLimit(
    `account-inbound-package:${auth.user.id}`,
    RATE_LIMITS.notification,
  );
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many packages submitted. Try again shortly.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const trackingNumber = clean(body.trackingNumber, 120);
  const supplierName = clean(body.supplierName, 120);
  const description = clean(body.description, 240);
  const notes = clean(body.notes, 500);

  if (trackingNumber.length < 4) {
    return NextResponse.json({ error: 'Enter a valid supplier tracking number.' }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('shipping_mark')
    .eq('id', auth.user.id)
    .single();
  if (profileError || !profile?.shipping_mark) {
    return NextResponse.json({ error: 'Could not find your shipping mark.' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('inbound_packages')
    .select('id, status, supplier_tracking_number')
    .eq('customer_user_id', auth.user.id)
    .limit(100);
  const duplicate = (existing || []).find(
    (row: any) =>
      normalizeTracking(row.supplier_tracking_number || '') === normalizeTracking(trackingNumber),
  );
  if (duplicate) {
    return NextResponse.json(
      { error: 'This tracking number is already registered.', packageId: duplicate.id },
      { status: 409 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('inbound_packages')
    .insert({
      customer_user_id: auth.user.id,
      customer_email: auth.user.email?.trim().toLowerCase() || null,
      shipping_mark_snapshot: profile.shipping_mark,
      supplier_tracking_number: trackingNumber,
      supplier_name: supplierName || null,
      description: description || null,
      notes: notes || null,
      status: 'expected',
      source: 'customer',
      created_by: auth.user.id,
    })
    .select(
      'id, supplier_tracking_number, supplier_name, description, status, created_at',
    )
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'This tracking number is already registered.' }, { status: 409 });
    }
    console.error('[register inbound package]', error);
    return NextResponse.json({ error: 'Could not register this package.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, package: data }, { status: 201 });
}
