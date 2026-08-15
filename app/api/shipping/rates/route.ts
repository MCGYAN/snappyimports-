import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import type { ShippingRateBoard } from '@/lib/shipping';

function mapBoard(row: any): ShippingRateBoard {
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

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('shipping_rate_board')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Shipping rates are not available.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, board: mapBoard(data) });
}

export async function PUT(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const numeric = (key: string, min = 0) => {
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < min) throw new Error(`Invalid ${key}`);
      return value;
    };

    const transitDays = Math.round(numeric('default_transit_days', 1));
    if (transitDays > 180) {
      return NextResponse.json({ error: 'Transit days must be between 1 and 180.' }, { status: 400 });
    }
    const invoiceValidDays = Math.round(numeric('invoice_valid_days', 1));
    if (invoiceValidDays > 30) {
      return NextResponse.json({ error: 'Invoice validity must be between 1 and 30 days.' }, { status: 400 });
    }

    const payload = {
      id: 1,
      usd_to_ghs: numeric('usd_to_ghs'),
      normal_usd_per_cbm: numeric('normal_usd_per_cbm'),
      sensitive_usd_per_cbm: numeric('sensitive_usd_per_cbm'),
      heavy_usd_per_cbm: numeric('heavy_usd_per_cbm'),
      bulk_usd_per_cbm: numeric('bulk_usd_per_cbm'),
      default_transit_days: transitDays,
      invoice_valid_days: invoiceValidDays,
      notes: String(body.notes || '').trim().slice(0, 500) || null,
      updated_by: auth.user?.id || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('shipping_rate_board')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      console.error('[shipping rates]', error);
      return NextResponse.json({ error: 'Could not save shipping rates.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, board: mapBoard(data) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid shipping rates.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
