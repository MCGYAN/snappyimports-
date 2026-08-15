import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  const body = await req.json();
  const orderNumber = String(body.orderNumber || '').trim();
  if (!orderNumber) {
    return NextResponse.json({ error: 'Order number required.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('undo_manual_order_payment', {
    order_ref: orderNumber,
    actor_id: auth.user?.id,
  });
  if (error) {
    return NextResponse.json(
      { error: error.message.includes('window') ? 'The 2-minute undo window has closed.' : 'Could not undo payment.' },
      { status: 400 },
    );
  }
  return NextResponse.json({ success: true, order: data });
}
