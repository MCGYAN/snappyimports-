/**
 * China → Ghana fulfillment journey shown on order tracking / admin.
 * Kept to a few real milestones so customers stay informed without
 * forcing admin to click through every micro-step.
 */

export type FulfillmentStage =
  | 'awaiting_payment'
  | 'payment_sent'
  | 'paid'
  | 'sourcing'
  | 'en_route_ghana'
  | 'in_ghana'
  | 'ready'
  | 'delivered'
  | 'cancelled';

/** Stages admin usually sets by hand after money is confirmed */
export const ADMIN_FULFILLMENT_STAGES: FulfillmentStage[] = [
  'sourcing',
  'en_route_ghana',
  'in_ghana',
  'ready',
  'delivered',
];

export const FULFILLMENT_STAGES: Array<{
  key: FulfillmentStage;
  title: string;
  description: string;
  /** If true, system sets this from payment events. Admin rarely needs to. */
  auto?: boolean;
}> = [
  {
    key: 'awaiting_payment',
    title: 'Awaiting payment',
    description: 'Invoice or MoMo checkout is open. Pay to start your import.',
    auto: true,
  },
  {
    key: 'payment_sent',
    title: 'Payment sent',
    description: 'You marked payment as sent. Snappy is confirming it.',
    auto: true,
  },
  {
    key: 'paid',
    title: 'Payment confirmed',
    description: 'Money received. We start sourcing your order in China.',
    auto: true,
  },
  {
    key: 'sourcing',
    title: 'Sourcing in China',
    description: 'Supplier confirmed. Goods are being prepared and packed.',
  },
  {
    key: 'en_route_ghana',
    title: 'On the way to Ghana',
    description: 'Shipment has left China and is heading to Ghana.',
  },
  {
    key: 'in_ghana',
    title: 'In Ghana, clearing',
    description: 'Arrived at Tema / warehouse. Customs clearing in progress.',
  },
  {
    key: 'ready',
    title: 'Ready for you',
    description: 'Ready for store pickup or delivery booking.',
  },
  {
    key: 'delivered',
    title: 'Delivered / collected',
    description: 'Order completed. Enjoy your import.',
  },
];

/** Old stage keys → current milestones (keeps existing orders readable) */
const LEGACY_STAGE_MAP: Record<string, FulfillmentStage> = {
  awaiting_payment: 'awaiting_payment',
  payment_sent: 'payment_sent',
  paid: 'paid',
  sourcing: 'sourcing',
  packed: 'sourcing',
  left_china: 'en_route_ghana',
  in_transit: 'en_route_ghana',
  in_transit_china: 'en_route_ghana',
  en_route_ghana: 'en_route_ghana',
  arrived_ghana: 'in_ghana',
  clearing: 'in_ghana',
  in_ghana: 'in_ghana',
  ready: 'ready',
  ready_for_delivery: 'ready',
  out_for_delivery: 'ready',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

export type DeliveryBooking = {
  address: string;
  city?: string;
  preferredDate?: string;
  preferredTime?: string;
  notes?: string;
  bookedAt: string;
  status: 'requested' | 'scheduled' | 'completed' | 'cancelled';
};

export function normalizeFulfillmentStage(
  stage: string | null | undefined,
): FulfillmentStage | null {
  if (!stage) return null;
  return LEGACY_STAGE_MAP[stage] || null;
}

export function deriveFulfillmentStage(order: {
  status?: string;
  payment_status?: string;
  metadata?: Record<string, any> | null;
}): FulfillmentStage {
  const meta = order.metadata || {};
  const normalized = normalizeFulfillmentStage(meta.fulfillment_stage);
  if (normalized === 'cancelled' || order.status === 'cancelled') return 'cancelled';
  if (normalized === 'delivered' || order.status === 'delivered') return 'delivered';

  // Prefer an explicit post-payment milestone stored by admin
  if (
    normalized &&
    !['awaiting_payment', 'payment_sent', 'paid'].includes(normalized)
  ) {
    return normalized;
  }

  if (order.payment_status === 'awaiting_confirmation' || meta.payment_sent_at) {
    if (order.payment_status !== 'paid') return 'payment_sent';
  }
  if (order.payment_status !== 'paid') return 'awaiting_payment';

  // Paid but admin has not advanced the import journey yet
  if (normalized === 'paid' || !normalized) {
    if (order.status === 'shipped') return 'en_route_ghana';
    return 'paid';
  }

  return normalized;
}

export function fulfillmentIndex(stage: FulfillmentStage): number {
  if (stage === 'cancelled') return -1;
  return FULFILLMENT_STAGES.findIndex((s) => s.key === stage);
}

/** Map journey stage → core order_status enum for DB consistency */
export function orderStatusForStage(stage: FulfillmentStage): string {
  switch (stage) {
    case 'cancelled':
      return 'cancelled';
    case 'delivered':
      return 'delivered';
    case 'sourcing':
    case 'paid':
      return 'processing';
    case 'en_route_ghana':
    case 'in_ghana':
    case 'ready':
      return 'shipped';
    case 'payment_sent':
      return 'awaiting_payment';
    case 'awaiting_payment':
    default:
      return 'pending';
  }
}

/** Stages where customer may book delivery / pickup planning */
export function canBookDelivery(stage: FulfillmentStage): boolean {
  return ['in_ghana', 'ready', 'en_route_ghana'].includes(stage);
}
