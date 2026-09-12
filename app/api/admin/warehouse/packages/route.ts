import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

function clean(value: unknown, max: number): string | null {
  const result = String(value ?? '').trim().slice(0, max);
  return result || null;
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number;
}

function positiveInteger(value: unknown): number | null {
  const number = positiveNumber(value);
  if (number == null) return null;
  return Math.max(1, Math.round(number));
}

function optionalDate(value: unknown): string | null {
  const text = clean(value, 40);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizedGoodsClass(
  value: unknown,
): 'normal' | 'sensitive' | 'heavy' | 'bulk' | 'custom' | null {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (!normalized || ['normal', 'normalproduct'].includes(normalized)) return 'normal';
  if (['sensitive', 'sensitiveproduct', 'restricted'].includes(normalized)) return 'sensitive';
  if (['heavy', 'heavyproduct'].includes(normalized)) return 'heavy';
  if (['bulk', 'bulkcargo', 'bulkproduct'].includes(normalized)) return 'bulk';
  if (normalized === 'custom') return 'custom';
  return null;
}

async function loadFreightPackages() {
  const { data, error } = await supabaseAdmin
    .from('inbound_packages')
    .select(
      `
      id,
      customer_user_id,
      customer_email,
      shipping_mark_snapshot,
      supplier_tracking_number,
      description,
      cartons,
      cbm,
      goods_class,
      custom_usd_per_cbm,
      status,
      received_at,
      loaded_at,
      estimated_arrival_at,
      vessel,
      notes,
      shipping_package_id,
      created_at,
      updated_at,
      shipping_packages (
        id,
        tracking_id,
        status,
        shipping_payment_status,
        estimated_arrival_at,
        loaded_at,
        cbm,
        goods_class
      )
    `,
    )
    .in('status', ['received', 'converted', 'expected'])
    .order('updated_at', { ascending: false })
    .limit(80);

  if (error) throw error;
  return data || [];
}

export async function GET(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'warehouse' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const [{ data: board }, packages] = await Promise.all([
      supabaseAdmin
        .from('shipping_rate_board')
        .select('default_transit_days, normal_usd_per_cbm, sensitive_usd_per_cbm, heavy_usd_per_cbm, bulk_usd_per_cbm')
        .eq('id', 1)
        .maybeSingle(),
      loadFreightPackages(),
    ]);

    return NextResponse.json({
      success: true,
      packages,
      defaultTransitDays: board?.default_transit_days ?? 45,
      rates: board || null,
    });
  } catch (error) {
    console.error('[warehouse packages GET]', error);
    return NextResponse.json({ error: 'Could not load freight packages.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'warehouse' });
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const shippingMark = clean(body.shippingMark, 120)?.toUpperCase();
  const trackingNumber = clean(body.trackingNumber, 120);
  const description = clean(body.description, 300);
  const cartons = positiveInteger(body.cartons);
  const cbm = positiveNumber(body.cbm);
  const goodsClass = normalizedGoodsClass(body.goodsClass) || 'normal';
  const customUsdPerCbm = positiveNumber(body.customUsdPerCbm);
  const receivedAt = optionalDate(body.receivedAt);
  const loadedAt = optionalDate(body.loadedAt);
  const estimatedArrivalAt = optionalDate(body.estimatedArrivalAt);
  const vessel = clean(body.vessel, 120);
  const notes = clean(body.notes, 500);
  const transitDays = positiveInteger(body.transitDays);

  if (!shippingMark || !trackingNumber || cbm == null) {
    return NextResponse.json(
      { error: 'Shipping mark, tracking number and CBM are required.' },
      { status: 400 },
    );
  }
  if (goodsClass === 'custom' && customUsdPerCbm == null) {
    return NextResponse.json({ error: 'Custom class needs a USD per CBM rate.' }, { status: 400 });
  }

  const normalizedMark = shippingMark.replace(/\s+/g, ' ');
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, shipping_mark')
    .not('shipping_mark', 'is', null)
    .limit(2000);

  if (profileError) {
    console.error('[warehouse package create profile]', profileError);
    return NextResponse.json({ error: 'Could not look up that shipping mark.' }, { status: 500 });
  }

  const profile = (profiles || []).find(
    (row) =>
      String(row.shipping_mark || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase() === normalizedMark,
  );

  if (!profile) {
    return NextResponse.json(
      { error: 'No registered customer has that shipping mark.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc('import_warehouse_package', {
    p_customer_user_id: profile.id,
    p_customer_email: profile.email,
    p_shipping_mark: shippingMark,
    p_tracking_number: trackingNumber,
    p_description: description,
    p_cartons: cartons,
    p_cbm: cbm,
    p_goods_class: goodsClass,
    p_custom_usd_per_cbm: customUsdPerCbm,
    p_received_at: receivedAt,
    p_loaded_at: loadedAt,
    p_estimated_arrival_at: estimatedArrivalAt,
    p_vessel: vessel,
    p_notes: notes,
    p_import_batch_id: null,
    p_created_by: auth.user.id,
    p_transit_days: transitDays,
  });

  if (error) {
    console.error('[warehouse package create]', error);
    return NextResponse.json({ error: error.message || 'Could not save package.' }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    success: true,
    inboundPackageId: row?.inbound_package_id,
    shippingPackageId: row?.shipping_package_id,
    wasExisting: Boolean(row?.was_existing),
  });
}

export async function PATCH(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'warehouse' });
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const inboundId = clean(body.id, 80);
  if (!inboundId) {
    return NextResponse.json({ error: 'Package id is required.' }, { status: 400 });
  }

  const { data: inbound, error: loadError } = await supabaseAdmin
    .from('inbound_packages')
    .select(
      'id, customer_user_id, customer_email, shipping_mark_snapshot, supplier_tracking_number, shipping_package_id, loaded_at, estimated_arrival_at',
    )
    .eq('id', inboundId)
    .maybeSingle();

  if (loadError || !inbound) {
    return NextResponse.json({ error: 'Package not found.' }, { status: 404 });
  }

  const description = clean(body.description, 300);
  const cartons = positiveInteger(body.cartons);
  const cbm = positiveNumber(body.cbm);
  const goodsClass = normalizedGoodsClass(body.goodsClass);
  const customUsdPerCbm = positiveNumber(body.customUsdPerCbm);
  const receivedAt = optionalDate(body.receivedAt);
  const loadedAt = optionalDate(body.loadedAt);
  const estimatedArrivalAt = optionalDate(body.estimatedArrivalAt);
  const vessel = clean(body.vessel, 120);
  const notes = clean(body.notes, 500);
  const transitDays = positiveInteger(body.transitDays);

  if (cbm == null) {
    return NextResponse.json({ error: 'CBM must be greater than zero.' }, { status: 400 });
  }
  if (goodsClass === 'custom' && customUsdPerCbm == null) {
    return NextResponse.json({ error: 'Custom class needs a USD per CBM rate.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('import_warehouse_package', {
    p_customer_user_id: inbound.customer_user_id,
    p_customer_email: inbound.customer_email,
    p_shipping_mark: inbound.shipping_mark_snapshot,
    p_tracking_number: inbound.supplier_tracking_number,
    p_description: description,
    p_cartons: cartons,
    p_cbm: cbm,
    p_goods_class: goodsClass || 'normal',
    p_custom_usd_per_cbm: customUsdPerCbm,
    p_received_at: receivedAt,
    p_loaded_at: loadedAt,
    p_estimated_arrival_at: estimatedArrivalAt,
    p_vessel: vessel,
    p_notes: notes,
    p_import_batch_id: null,
    p_created_by: auth.user.id,
    p_transit_days: transitDays,
  });

  if (error) {
    console.error('[warehouse package patch]', error);
    return NextResponse.json({ error: error.message || 'Could not update package.' }, { status: 400 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({
    success: true,
    inboundPackageId: row?.inbound_package_id,
    shippingPackageId: row?.shipping_package_id,
    wasExisting: Boolean(row?.was_existing),
  });
}
