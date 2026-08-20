import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  orderStatusForStage,
  rollupFulfillmentStageFromPackages,
  storedFulfillmentStage,
  type FulfillmentStage,
} from '@/lib/order-journey';

/** Linked package statuses for an order (empty when nothing is packed yet). */
export async function fetchPackageStatusesForOrder(orderId: string): Promise<string[]> {
  const { data: orderItems } = await supabaseAdmin
    .from('order_items')
    .select('id')
    .eq('order_id', orderId);
  const itemIds = (orderItems || []).map((item) => item.id);
  if (!itemIds.length) return [];

  const { data: links } = await supabaseAdmin
    .from('shipping_package_items')
    .select('package_id')
    .in('order_item_id', itemIds);
  const packageIds = [...new Set((links || []).map((link) => link.package_id))];
  if (!packageIds.length) return [];

  const { data: packages } = await supabaseAdmin
    .from('shipping_packages')
    .select('status')
    .in('id', packageIds);
  return (packages || []).map((pkg) => pkg.status).filter(Boolean);
}

/**
 * Once physical packages exist, their statuses become the source of truth for
 * the order's high-level journey. Mixed package progress intentionally rolls
 * up to the clearest honest summary while customers see each package itself.
 */
export async function refreshOrderShippingStage(orderId: string, actorId?: string | null) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, payment_status, metadata')
    .eq('id', orderId)
    .single();
  if (!order) return null;

  const packageStatuses = await fetchPackageStatusesForOrder(orderId);
  if (!packageStatuses.length) return null;
  if (order.payment_status !== 'paid') return null;

  const nextStage = rollupFulfillmentStageFromPackages(packageStatuses);
  if (!nextStage) return null;

  const storedStage = storedFulfillmentStage(order);
  if (storedStage === 'cancelled' || storedStage === 'delivered') return storedStage;

  const currentStage =
    storedStage === 'paid' || storedStage === 'awaiting_payment' || storedStage === 'payment_sent'
      ? ('sourcing' as FulfillmentStage)
      : storedStage;
  if (currentStage === nextStage) return nextStage;

  const nowIso = new Date().toISOString();
  const history = Array.isArray(order.metadata?.fulfillment_history)
    ? order.metadata.fulfillment_history
    : [];
  await supabaseAdmin
    .from('orders')
    .update({
      status: orderStatusForStage(nextStage),
      metadata: {
        ...(order.metadata || {}),
        fulfillment_stage: nextStage,
        fulfillment_updated_at: nowIso,
        fulfillment_history: [
          ...history,
          { stage: nextStage, at: nowIso, by: actorId || null, source: 'shipping_packages' },
        ],
      },
      updated_at: nowIso,
    })
    .eq('id', orderId);
  return nextStage;
}
