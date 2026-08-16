import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  const auth = await verifyAuth(req);
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const email = auth.user.email?.trim().toLowerCase();
  const customerOwnerFilter = email
    ? `customer_user_id.eq.${auth.user.id},customer_email.ilike.${email}`
    : `customer_user_id.eq.${auth.user.id}`;
  const documentId = url.searchParams.get('document');
  if (documentId) {
    const { data, error } = await supabaseAdmin
      .from('financial_documents')
      .select(
        'id, document_number, document_type, flow, currency, amount, status, issued_at, due_at, paid_at, customer_email, data',
      )
      .eq('id', documentId)
      .or(customerOwnerFilter)
      .neq('status', 'void')
      .maybeSingle();

    if (error) {
      console.error('[account portal document]', error);
      return NextResponse.json({ error: 'Could not load this document.' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    return NextResponse.json({ success: true, document: data });
  }

  const requested = new Set(
    (url.searchParams.get('include') || 'packages,documents,board')
      .split(',')
      .map((value) => value.trim()),
  );
  const includePackages = requested.has('packages');
  const includeDocuments = requested.has('documents');
  const includeBoard = requested.has('board');

  const [packagesResult, documentsResult, rateResult] = await Promise.all([
    includePackages
      ? supabaseAdmin
          .from('shipping_packages')
          .select(
            'id, package_name, tracking_id, status, cbm, freight_included, final_shipping_ghs, estimated_shipping_usd, final_usd_to_ghs, estimated_arrival_at, customer_email, shipping_package_items(quantity, order_items(product_name, orders(order_number, email)))',
          )
          .or(customerOwnerFilter)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    includeDocuments
      ? supabaseAdmin
          .from('financial_documents')
          .select(
            'id, document_number, document_type, flow, currency, amount, status, issued_at, due_at, paid_at, customer_email',
          )
          .or(customerOwnerFilter)
          .neq('status', 'void')
          .order('issued_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    includeBoard
      ? supabaseAdmin
          .from('shipping_rate_board')
          .select(
            'id, usd_to_ghs, normal_usd_per_cbm, sensitive_usd_per_cbm, heavy_usd_per_cbm, bulk_usd_per_cbm',
          )
          .eq('id', 1)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (packagesResult.error || documentsResult.error || rateResult.error) {
    console.error(
      '[account portal]',
      packagesResult.error || documentsResult.error || rateResult.error,
    );
    return NextResponse.json({ error: 'Could not load your account records.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    ...(includePackages ? { packages: packagesResult.data || [] } : {}),
    ...(includeDocuments ? { documents: documentsResult.data || [] } : {}),
    ...(includeBoard ? { board: rateResult.data || null } : {}),
  });
}
