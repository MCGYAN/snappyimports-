/**
 * China → Ghana fulfillment journey shown on order tracking / admin.
 */

export type FulfillmentStage =
  | 'awaiting_payment'
  | 'payment_sent'
  | 'paid'
  | 'sourcing'
  | 'packed'
  | 'left_china'
  | 'in_transit'
  | 'arrived_ghana'
  | 'clearing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export const FULFILLMENT_STAGES: Array<{
  key: FulfillmentStage;
  title: string;
  description: string;
}> = [
  { key: 'awaiting_payment', title: 'Awaiting payment', description: 'Invoice issued. Pay to unlock shipping' },
  { key: 'payment_sent', title: 'Payment sent', description: 'Customer marked payment as sent. Awaiting confirmation' },
  { key: 'paid', title: 'Payment confirmed', description: 'Money received. We start your import' },
  { key: 'sourcing', title: 'Sourcing in China', description: 'Supplier confirmed / packing list ready' },
  { key: 'packed', title: 'Packed', description: 'Goods packed and ready to leave China' },
  { key: 'left_china', title: 'Left China', description: 'Shipment departed China' },
  { key: 'in_transit', title: 'In transit', description: 'On the way to Ghana' },
  { key: 'arrived_ghana', title: 'Arrived Ghana', description: 'At Tema port / warehouse' },
  { key: 'clearing', title: 'Clearing', description: 'Customs and clearing in progress' },
  { key: 'ready', title: 'Ready', description: 'Ready for pickup or delivery booking' },
  { key: 'out_for_delivery', title: 'Out for delivery', description: 'On the way to your address' },
  { key: 'delivered', title: 'Delivered', description: 'Order completed' },
];

export type DeliveryBooking = {
  address: string;
  city?: string;
  preferredDate?: string;
  preferredTime?: string;
  notes?: string;
  bookedAt: string;
  status: 'requested' | 'scheduled' | 'completed' | 'cancelled';
};

export function deriveFulfillmentStage(order: {
  status?: string;
  payment_status?: string;
  metadata?: Record<string, any> | null;
}): FulfillmentStage {
  const meta = order.metadata || {};
  if (meta.fulfillment_stage && FULFILLMENT_STAGES.some((s) => s.key === meta.fulfillment_stage)) {
    return meta.fulfillment_stage as FulfillmentStage;
  }

  if (order.status === 'cancelled') return 'cancelled';
  if (order.status === 'delivered') return 'delivered';
  if (order.payment_status === 'awaiting_confirmation' || meta.payment_sent_at) {
    if (order.payment_status !== 'paid') return 'payment_sent';
  }
  if (order.payment_status !== 'paid') return 'awaiting_payment';
  if (order.status === 'shipped') return 'packed';
  if (order.status === 'processing') return 'paid';
  return 'awaiting_payment';
}

export function fulfillmentIndex(stage: FulfillmentStage): number {
  return FULFILLMENT_STAGES.findIndex((s) => s.key === stage);
}

/** Map journey stage → core order_status enum for DB consistency */
export function orderStatusForStage(stage: FulfillmentStage): string {
  switch (stage) {
    case 'cancelled':
      return 'cancelled';
    case 'delivered':
      return 'delivered';
    case 'packed':
    case 'left_china':
    case 'in_transit':
    case 'arrived_ghana':
    case 'clearing':
    case 'ready':
    case 'out_for_delivery':
      return 'shipped';
    case 'paid':
    case 'sourcing':
      return 'processing';
    case 'payment_sent':
      return 'awaiting_payment';
    default:
      return 'pending';
  }
}
