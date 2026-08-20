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
        'id, document_number, document_type, flow, currency, amount, status, issued_at, due_at, paid_at, customer_email, shipping_package_id, data, shipping_packages(shipping_payment_status)',
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
  const includeOrderStatus = requested.has('order-status');

  const orderOwnerFilter = email
    ? `user_id.eq.${auth.user.id},email.ilike.${email}`
    : `user_id.eq.${auth.user.id}`;

  const [packagesResult, documentsResult, rateResult, ordersResult, exchangesResult] =
    await Promise.all([
      includePackages || includeOrderStatus
        ? supabaseAdmin
            .from('shipping_packages')
            .select(
              'id, package_name, tracking_id, status, cbm, freight_included, final_shipping_ghs, estimated_shipping_usd, final_usd_to_ghs, estimated_arrival_at, customer_email, shipping_payment_status, shipping_package_items(quantity, order_item_id, order_items(id, order_id, product_name, orders(id, order_number, email)))',
            )
            .or(customerOwnerFilter)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      includeDocuments || includeOrderStatus
        ? supabaseAdmin
            .from('financial_documents')
            .select(
              'id, document_number, document_type, flow, currency, amount, status, issued_at, due_at, paid_at, customer_email, shipping_package_id, order_id, data, shipping_packages(shipping_payment_status)',
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
      includeOrderStatus
        ? supabaseAdmin
            .from('orders')
            .select(
              'id, order_number, email, status, payment_status, total, currency, created_at, metadata, order_items(id, product_name, variant_name, quantity, unit_price, metadata)',
            )
            .or(orderOwnerFilter)
            .order('created_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
      includeOrderStatus
        ? supabaseAdmin
            .from('exchange_orders')
            .select(
              'id, exchange_number, phone, status, payment_status, amount_from, amount_to, rate, created_at, country_code',
            )
            .eq('user_id', auth.user.id)
            .order('created_at', { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (
    packagesResult.error ||
    documentsResult.error ||
    rateResult.error ||
    ordersResult.error ||
    exchangesResult.error
  ) {
    console.error(
      '[account portal]',
      packagesResult.error ||
        documentsResult.error ||
        rateResult.error ||
        ordersResult.error ||
        exchangesResult.error,
    );
    return NextResponse.json({ error: 'Could not load your account records.' }, { status: 500 });
  }

  let orderRows = ordersResult.data || [];
  if (includeOrderStatus && orderRows.length) {
    const { refreshOrderShippingStage } = await import('@/lib/shipping-sync');
    await Promise.all(
      orderRows.map((order: any) => refreshOrderShippingStage(order.id, auth.user?.id)),
    );
    const { data: refreshedOrders } = await supabaseAdmin
      .from('orders')
      .select(
        'id, order_number, email, status, payment_status, total, currency, created_at, metadata, order_items(id, product_name, variant_name, quantity, unit_price, metadata)',
      )
      .in(
        'id',
        orderRows.map((order: any) => order.id),
      )
      .order('created_at', { ascending: false });
    if (refreshedOrders) orderRows = refreshedOrders;
  }

  let orderStatusPayload: any[] | undefined;
  let rmbStatusPayload: any[] | undefined;
  if (includeOrderStatus) {
    const { isPastShopOrder, isPastRmbOrder } = await import('@/lib/account-order-status');
    const packages = packagesResult.data || [];
    const documents = documentsResult.data || [];
    orderStatusPayload = orderRows
      .filter((order: any) => !isPastShopOrder(order))
      .map((order: any) => {
        const itemIds = new Set((order.order_items || []).map((item: any) => item.id));
        const linkedPackages = packages.filter((pkg: any) =>
          (pkg.shipping_package_items || []).some(
            (entry: any) =>
              itemIds.has(entry.order_item_id) ||
              itemIds.has(entry.order_items?.id) ||
              entry.order_items?.order_id === order.id,
          ),
        );
        const openShippingInvoice =
          documents.find(
            (doc: any) =>
              doc.flow === 'shipping' &&
              doc.document_type === 'invoice' &&
              doc.status === 'active' &&
              linkedPackages.some((pkg: any) => pkg.id === doc.shipping_package_id),
          ) || null;

        return {
          kind: 'shop',
          ...order,
          packages: linkedPackages.map((pkg: any) => ({
            id: pkg.id,
            package_name: pkg.package_name,
            tracking_id: pkg.tracking_id,
            status: pkg.status,
            freight_included: Boolean(pkg.freight_included),
            final_usd_to_ghs: pkg.final_usd_to_ghs,
            shipping_payment_status: pkg.shipping_payment_status,
            final_shipping_ghs: pkg.final_shipping_ghs,
            estimated_shipping_usd: pkg.estimated_shipping_usd,
          })),
          openShippingInvoiceId: openShippingInvoice?.id || null,
        };
      });

    rmbStatusPayload = (exchangesResult.data || [])
      .filter((exchange: any) => !isPastRmbOrder(exchange))
      .map((exchange: any) => ({
        kind: 'rmb',
        ...exchange,
      }));
  }

  return NextResponse.json({
    success: true,
    ...(includePackages ? { packages: packagesResult.data || [] } : {}),
    ...(includeDocuments ? { documents: documentsResult.data || [] } : {}),
    ...(includeBoard ? { board: rateResult.data || null } : {}),
    ...(includeOrderStatus
      ? {
          orderStatus: orderStatusPayload || [],
          rmbStatus: rmbStatusPayload || [],
        }
      : {}),
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
