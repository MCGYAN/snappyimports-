import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  const auth = await verifyAuth(req);
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  await supabaseAdmin
    .from('financial_documents')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('document_type', 'invoice')
    .eq('status', 'active')
    .lt('due_at', new Date().toISOString());

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, email')
    .eq('user_id', auth.user.id);
  const orderIds = (orders || []).map((order) => order.id);

  const [packagesResult, documentsResult, rateResult] = await Promise.all([
    orderIds.length
      ? supabaseAdmin
          .from('shipping_packages')
          .select('*, orders(order_number, email)')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin
      .from('financial_documents')
      .select('*')
      .eq('customer_user_id', auth.user.id)
      .neq('status', 'void')
      .order('issued_at', { ascending: false }),
    supabaseAdmin.from('shipping_rate_board').select('*').eq('id', 1).single(),
  ]);

  if (packagesResult.error || documentsResult.error) {
    console.error('[account portal]', packagesResult.error || documentsResult.error);
    return NextResponse.json({ error: 'Could not load your account records.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    packages: packagesResult.data || [],
    documents: documentsResult.data || [],
    board: rateResult.data || null,
  });
}
