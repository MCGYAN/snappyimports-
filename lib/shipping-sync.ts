import { supabaseAdmin } from '@/lib/supabase-admin';
import { packageStatusForStage, shippingStatusIndex } from '@/lib/shipping';

/**
 * The import journey is the one place staff move an order forward. Packages
 * follow that milestone so the same status is never entered twice.
 */
export async function syncPackagesToStage(orderId: string, stage: string) {
  const target = packageStatusForStage(stage);
  if (!target) return 0;

  const { data: packages } = await supabaseAdmin
    .from('shipping_packages')
    .select('id, status, loaded_at, estimated_arrival_at, arrived_at')
    .eq('order_id', orderId);
  if (!packages?.length) return 0;

  const { data: board } = await supabaseAdmin
    .from('shipping_rate_board')
    .select('default_transit_days')
    .eq('id', 1)
    .maybeSingle();
  const transitDays = Number(board?.default_transit_days) || 45;
  const nowIso = new Date().toISOString();
  let moved = 0;

  for (const pkg of packages) {
    if (shippingStatusIndex(pkg.status) >= shippingStatusIndex(target)) continue;
    const patch: Record<string, any> = { status: target, updated_at: nowIso };
    if (target === 'in_transit') {
      patch.loaded_at = pkg.loaded_at || nowIso;
      patch.estimated_arrival_at =
        pkg.estimated_arrival_at ||
        new Date(
          new Date(pkg.loaded_at || nowIso).getTime() + transitDays * 86_400_000,
        ).toISOString();
    }
    if (['arrived', 'ready', 'delivered'].includes(target)) {
      patch.arrived_at = pkg.arrived_at || nowIso;
    }
    await supabaseAdmin.from('shipping_packages').update(patch).eq('id', pkg.id);
    moved++;
  }
  return moved;
}
