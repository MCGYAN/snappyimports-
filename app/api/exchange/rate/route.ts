import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';

/** GET — public current RMB desk rate */
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('exchange_rate_board')
    .select('*')
    .eq('id', 1)
    .single();

  if (error || !data) {
    return NextResponse.json({
      success: true,
      board: {
        buy_rmb_rate: 0.57,
        sell_rmb_rate: 0.59,
        min_amount_ghs: 100,
        max_amount_ghs: null,
        notes: 'Contact Snappy for today’s rate',
        valid_until: null,
      },
    });
  }

  return NextResponse.json({ success: true, board: data });
}

/** PUT — admin updates rate board */
export async function PUT(req: Request) {
  const auth = await verifyAuth(req, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const payload = {
    buy_rmb_rate: Number(body.buy_rmb_rate),
    sell_rmb_rate: Number(body.sell_rmb_rate),
    min_amount_ghs: Number(body.min_amount_ghs ?? 100),
    max_amount_ghs: body.max_amount_ghs != null ? Number(body.max_amount_ghs) : null,
    notes: body.notes ? String(body.notes).slice(0, 500) : null,
    valid_until: body.valid_until || null,
    updated_at: new Date().toISOString(),
  };

  if (!Number.isFinite(payload.buy_rmb_rate) || !Number.isFinite(payload.sell_rmb_rate)) {
    return NextResponse.json({ error: 'Valid rates required.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('exchange_rate_board')
    .upsert({ id: 1, ...payload })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, board: data });
}
