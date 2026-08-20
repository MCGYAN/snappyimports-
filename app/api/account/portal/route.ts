import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { markShippingPaymentSent } from '@/lib/mark-shipping-payment-sent';

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
            'id, document_number, document_type, flow, currency, amount, status, issued_at, due_at, paid_at, customer_email, shipping_package_id, data, shipping_packages(shipping_payment_status)',
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

export async function POST(req: Request) {
  const auth = await verifyAuth(req);
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const clientId = auth.user.id;
  const rate = checkRateLimit(`account-shipping-payment:${clientId}`, RATE_LIMITS.payment);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  if (action !== 'shipping_payment_sent') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  const documentId = String(body.documentId || '').trim();
  if (!documentId) {
    return NextResponse.json({ error: 'Document required.' }, { status: 400 });
  }

  const email = auth.user.email?.trim().toLowerCase();
  const customerOwnerFilter = email
    ? `customer_user_id.eq.${auth.user.id},customer_email.ilike.${email}`
    : `customer_user_id.eq.${auth.user.id}`;

  const { data: document, error } = await supabaseAdmin
    .from('financial_documents')
    .select(
      'id, document_number, document_type, flow, currency, amount, status, due_at, shipping_package_id, order_id, data, shipping_packages(id, package_name, tracking_id, shipping_payment_status)',
    )
    .eq('id', documentId)
    .or(customerOwnerFilter)
    .neq('status', 'void')
    .maybeSingle();

  if (error) {
    console.error('[account portal shipping payment]', error);
    return NextResponse.json({ error: 'Could not load this document.' }, { status: 500 });
  }
  if (!document || document.flow !== 'shipping' || document.document_type !== 'invoice') {
    return NextResponse.json({ error: 'Shipping invoice not found.' }, { status: 404 });
  }

  const pkg = Array.isArray(document.shipping_packages)
    ? document.shipping_packages[0]
    : document.shipping_packages;
  if (!pkg?.id) {
    return NextResponse.json({ error: 'Shipping package not found.' }, { status: 404 });
  }

  let orderNumber = String(document.data?.order_numbers?.[0] || document.data?.reference || '').trim();
  if (!orderNumber && document.order_id) {
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('order_number')
      .eq('id', document.order_id)
      .maybeSingle();
    orderNumber = order?.order_number || '';
  }
  if (!orderNumber) {
    return NextResponse.json({ error: 'Order reference missing on this invoice.' }, { status: 400 });
  }

  try {
    const result = await markShippingPaymentSent({
      pkg,
      invoice: document,
      orderNumber,
    });
    if (result.state === 'already_paid') {
      return NextResponse.json({ success: true, message: 'Payment is already confirmed.' });
    }
    if (result.state === 'already_submitted') {
      return NextResponse.json({
        success: true,
        message: 'Payment is already marked as sent. Snappy will confirm soon.',
      });
    }
    return NextResponse.json({ success: true, shipping_payment_status: 'awaiting_confirmation' });
  } catch (paymentError) {
    return NextResponse.json(
      {
        error:
          paymentError instanceof Error ? paymentError.message : 'Could not submit payment notice.',
      },
      { status: 400 },
    );
  }
}
