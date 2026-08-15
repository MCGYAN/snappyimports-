import { supabaseAdmin } from '@/lib/supabase-admin';
import { deriveFulfillmentStage, orderStatusForStage } from '@/lib/order-journey';
import { shippingStatusIndex } from '@/lib/shipping';

/**
 * Once physical packages exist, their statuses become the source of truth for
 * the order's high-level journey. Mixed package progress intentionally rolls
 * up to the clearest honest summary while customers see each package itself.
 */
export async function refreshOrderShippingStage(orderId: string, actorId?: string | null) {
  const [{ data: orderItems }, { data: order }] = await Promise.all([
    supabaseAdmin.from('order_items').select('id').eq('order_id', orderId),
    supabaseAdmin.from('orders').select('id, status, payment_status, metadata').eq('id', orderId).single(),
  ]);
  const itemIds = (orderItems || []).map((item) => item.id);
  if (!order || !itemIds.length) return null;

  const { data: links } = await supabaseAdmin
    .from('shipping_package_items')
    .select('package_id')
    .in('order_item_id', itemIds);
  const packageIds = [...new Set((links || []).map((link) => link.package_id))];
  if (!packageIds.length) return null;

  const { data: packages } = await supabaseAdmin
    .from('shipping_packages')
    .select('status')
    .in('id', packageIds);
  if (!order || !packages?.length) return null;

  const indexes = packages.map((pkg) => shippingStatusIndex(pkg.status));
  const allAtLeast = (status: string) =>
    indexes.every((index) => index >= shippingStatusIndex(status));
  const anyAtLeast = (status: string) =>
    indexes.some((index) => index >= shippingStatusIndex(status));

  const nextStage = allAtLeast('delivered')
    ? 'delivered'
    : allAtLeast('ready')
      ? 'ready'
      : allAtLeast('arrived')
        ? 'in_ghana'
        : anyAtLeast('in_transit')
          ? 'en_route_ghana'
          : 'sourcing';
  const currentStage = deriveFulfillmentStage(order);
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
