import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAdminNotification } from '@/lib/admin-notifications';
import { emailLayout, sendEmail } from '@/lib/notifications';

type ShippingPaymentInvoice = {
  currency: string;
  amount: number;
  status?: string | null;
  due_at?: string | null;
};

type ShippingPaymentPackage = {
  id: string;
  package_name: string;
  tracking_id: string;
  shipping_payment_status?: string | null;
};

export async function markShippingPaymentSent({
  pkg,
  invoice,
  orderNumber,
}: {
  pkg: ShippingPaymentPackage;
  invoice: ShippingPaymentInvoice;
  orderNumber: string;
}) {
  if (
    !invoice ||
    invoice.status === 'expired' ||
    (invoice.due_at && new Date(invoice.due_at).getTime() < Date.now())
  ) {
    throw new Error('This shipping invoice expired. Ask Snappy for a fresh one.');
  }
  if (pkg.shipping_payment_status === 'paid') {
    return { state: 'already_paid' as const };
  }
  if (pkg.shipping_payment_status === 'awaiting_confirmation') {
    return { state: 'already_submitted' as const };
  }

  const now = new Date().toISOString();
  await supabaseAdmin
    .from('shipping_packages')
    .update({
      shipping_payment_status: 'awaiting_confirmation',
      shipping_payment_sent_at: now,
      updated_at: now,
    })
    .eq('id', pkg.id);

  await createAdminNotification({
    type: 'shipping_payment_sent',
    title: 'Shipping payment to confirm',
    message: `${orderNumber} says ${invoice.currency} ${Number(invoice.amount).toFixed(2)} was paid for ${pkg.package_name}.`,
    href: '/admin/shipping',
    entityId: pkg.id,
    entityNumber: pkg.tracking_id,
  });

  const adminEmail = String(process.env.ADMIN_EMAIL || '').trim();
  if (adminEmail.includes('@')) {
    try {
      await sendEmail({
        to: adminEmail,
        subject: `Shipping payment to confirm ${orderNumber}`,
        html: emailLayout(
          `
<h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Customer says shipping was paid</h2>
<p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
  Check the Snappy account for <strong>${orderNumber}</strong>. Confirm
  <strong>GH¢${Number(invoice.amount).toFixed(2)}</strong> only after it appears in the bank or MoMo account.
</p>
`,
          `Shipping payment to confirm for ${orderNumber}`,
        ),
      });
    } catch (error) {
      console.error('[shipping payment] admin email', error);
    }
  }

  return { state: 'submitted' as const };
}
