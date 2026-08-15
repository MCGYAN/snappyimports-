import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { createAdminNotification } from '@/lib/admin-notifications';
import { emailLayout, sendEmail } from '@/lib/notifications';

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
    if (!invoice || invoice.status === 'expired' || (invoice.due_at && new Date(invoice.due_at) < new Date())) {
      return NextResponse.json({ error: 'This shipping invoice expired. Request a fresh one.' }, { status: 400 });
    }
    if (pkg.shipping_payment_status === 'paid') {
      return NextResponse.json({ success: true, message: 'Payment is already confirmed.' });
    }
    await supabaseAdmin
      .from('shipping_packages')
      .update({
        shipping_payment_status: 'awaiting_confirmation',
        shipping_payment_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pkg.id);
    await createAdminNotification({
      type: 'shipping_payment_sent',
      title: 'Shipping payment to confirm',
      message: `${order.order_number} says ${invoice.currency} ${Number(invoice.amount).toFixed(2)} was paid for ${pkg.package_name}.`,
      href: '/admin/shipping',
      entityId: pkg.id,
      entityNumber: pkg.tracking_id,
    });
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim();
    if (adminEmail.includes('@')) {
      try {
        await sendEmail({
          to: adminEmail,
          subject: `Shipping payment to confirm ${order.order_number}`,
          html: emailLayout(`
<h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Customer says shipping was paid</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
  Check the Snappy account for <strong>${order.order_number}</strong>. Confirm
  <strong>GH¢${Number(invoice.amount).toFixed(2)}</strong> only after it appears in the bank or MoMo account.
</p>
`, `Shipping payment to confirm for ${order.order_number}`),
        });
      } catch (error) {
        console.error('[shipping payment] admin email', error);
      }
    }
    return NextResponse.json({ success: true });
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
