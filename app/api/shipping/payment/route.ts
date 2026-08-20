import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { markShippingPaymentSent } from '@/lib/mark-shipping-payment-sent';
import { createAdminNotification } from '@/lib/admin-notifications';

export async function POST(req: Request) {
  const clientId = getClientIdentifier(req);
  const rate = checkRateLimit(`shipping-payment:${clientId}`, RATE_LIMITS.payment);
  if (!rate.success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });

  const body = await req.json();
  const action = String(body.action || '');
  const orderNumber = String(body.orderNumber || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const packageId = String(body.packageId || '').trim();
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, email, order_items(id)')
    .eq('order_number', orderNumber)
    .single();
  if (!order || String(order.email || '').toLowerCase() !== email) {
    return NextResponse.json({ error: 'Order details do not match.' }, { status: 403 });
  }
  const { data: pkg } = await supabaseAdmin
    .from('shipping_packages')
    .select('*')
    .eq('id', packageId)
    .single();
  if (!pkg) return NextResponse.json({ error: 'Package not found.' }, { status: 404 });
  const orderItemIds = (order.order_items || []).map((item: any) => item.id);
  const { count: membershipCount } = orderItemIds.length
    ? await supabaseAdmin
        .from('shipping_package_items')
        .select('id', { count: 'exact', head: true })
        .eq('package_id', packageId)
        .in('order_item_id', orderItemIds)
    : { count: 0 };
  if (!membershipCount) {
    return NextResponse.json({ error: 'Package not found.' }, { status: 404 });
  }

  const { data: invoice } = await supabaseAdmin
    .from('financial_documents')
    .select('*')
    .eq('flow', 'shipping')
    .eq('entity_id', pkg.id)
    .eq('document_type', 'invoice')
    .neq('status', 'void')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (action === 'payment_sent') {
    try {
      const result = await markShippingPaymentSent({
        pkg,
        invoice,
        orderNumber: order.order_number,
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
      return NextResponse.json({ success: true });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Could not submit payment notice.' },
        { status: 400 },
      );
    }
  }

  if (action === 'request_invoice') {
    await createAdminNotification({
      type: 'shipping_invoice_requested',
      title: 'Fresh shipping invoice requested',
      message: `${order.order_number} needs a new rate for ${pkg.package_name}.`,
      href: '/admin/shipping',
      entityId: pkg.id,
      entityNumber: pkg.tracking_id,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
