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
  const { data: ownedItems } = orderIds.length
    ? await supabaseAdmin.from('order_items').select('id').in('order_id', orderIds)
    : { data: [] };
  const ownedItemIds = (ownedItems || []).map((item) => item.id);
  const { data: packageLinks } = ownedItemIds.length
    ? await supabaseAdmin
        .from('shipping_package_items')
        .select('package_id')
        .in('order_item_id', ownedItemIds)
    : { data: [] };
  const packageIds = [...new Set((packageLinks || []).map((link) => link.package_id))];

  const [packagesResult, documentsResult, rateResult] = await Promise.all([
    packageIds.length
      ? supabaseAdmin
          .from('shipping_packages')
          .select(
            '*, shipping_package_items(quantity, order_item_id, order_items(id, order_id, product_name, variant_name, quantity, metadata, orders(order_number, email)))',
          )
          .in('id', packageIds)
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
