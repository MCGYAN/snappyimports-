import { supabaseAdmin } from '@/lib/supabase-admin';

export type AdminNotificationInput = {
  type:
    | 'order_created'
    | 'order_payment_sent'
    | 'order_paid'
    | 'exchange_created'
    | 'exchange_payment_sent'
    | 'exchange_paid'
    | 'shipping_payment_sent'
    | 'shipping_invoice_requested'
    | 'delivery_request';
  title: string;
  message: string;
  href: string;
  entityId?: string;
  entityNumber?: string;
};

/**
 * Fan an operational alert out to every active admin/staff account.
 * This must only be called from trusted server routes.
 */
export async function createAdminNotification(input: AdminNotificationInput) {
  const { data: staff, error: staffError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'staff']);

  if (staffError) {
    console.error('[admin notification] could not load recipients:', staffError.message);
    return;
  }

  if (!staff?.length) return;

  const rows = staff.map((profile) => ({
    user_id: profile.id,
    type: input.type,
    title: input.title,
    message: input.message,
    data: {
      href: input.href,
      entity_id: input.entityId || null,
      entity_number: input.entityNumber || null,
    },
  }));

  const { error } = await supabaseAdmin.from('notifications').insert(rows);
  if (error) {
    console.error('[admin notification] insert failed:', error.message);
  }
}
