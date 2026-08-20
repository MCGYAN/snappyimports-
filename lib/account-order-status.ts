import {
  deriveFulfillmentStage,
  type FulfillmentStage,
} from '@/lib/order-journey';
import { shippingStatusIndex } from '@/lib/shipping';

/**
 * Customer Account → Order status.
 * Labels match admin Shipping / Orders wording so clients see the same language staff use.
 */
export type AccountOrderStatusKey =
  | 'awaiting_payment'
  | 'payment_sent'
  | 'payment_confirmed'
  | 'sourcing'
  | 'needs_packing'
  | 'received_at_warehouse'
  | 'in_transit'
  | 'arrived_in_ghana'
  | 'waiting_for_payment'
  | 'payment_check'
  | 'release_goods'
  | 'ready_for_you'
  | 'delivered'
  | 'cancelled';

export type AccountOrderStatusStep = {
  key: AccountOrderStatusKey;
  title: string;
  description: string;
};

export const ACCOUNT_ORDER_STATUS_STEPS: AccountOrderStatusStep[] = [
  {
    key: 'awaiting_payment',
    title: 'Awaiting payment',
    description: 'Your product invoice is open. Pay to start this import.',
  },
  {
    key: 'payment_sent',
    title: 'Payment sent',
    description: 'You marked product payment as sent. Snappy is confirming it.',
  },
  {
    key: 'payment_confirmed',
    title: 'Payment confirmed',
    description: 'Money received. Snappy will start sourcing in China.',
  },
  {
    key: 'sourcing',
    title: 'Sourcing in China',
    description: 'Supplier work has started. Goods are being prepared.',
  },
  {
    key: 'needs_packing',
    title: 'Needs packing',
    description: 'Paid items are in Packages, waiting for a physical box.',
  },
  {
    key: 'received_at_warehouse',
    title: 'Received at warehouse',
    description: 'Your package is packed and waiting to leave China.',
  },
  {
    key: 'in_transit',
    title: 'In transit',
    description: 'Shipment is on the way from China to Ghana.',
  },
  {
    key: 'arrived_in_ghana',
    title: 'Arrived in Ghana',
    description: 'Goods have landed. Snappy is locking the shipping bill.',
  },
  {
    key: 'waiting_for_payment',
    title: 'Pay shipping',
    description: 'Shipping bill is locked. Pay freight, then tap I\'ve paid.',
  },
  {
    key: 'payment_check',
    title: 'Payment check',
    description: 'You said shipping was paid. Snappy is confirming in bank or MoMo.',
  },
  {
    key: 'release_goods',
    title: 'Release goods',
    description: 'Freight is cleared. Snappy will mark the package ready for you.',
  },
  {
    key: 'ready_for_you',
    title: 'Ready for you',
    description: 'Ready for store pickup or delivery booking.',
  },
  {
    key: 'delivered',
    title: 'Delivered / collected',
    description: 'Order completed. Enjoy your import.',
  },
];

export type AccountOrderPackageSummary = {
  id: string;
  package_name: string;
  tracking_id: string;
  status: string;
  freight_included: boolean;
  final_usd_to_ghs: number | null;
  shipping_payment_status: string | null;
  final_shipping_ghs: number | null;
  estimated_shipping_usd: number | null;
};

export type AccountOrderStatusResult = {
  key: AccountOrderStatusKey;
  title: string;
  description: string;
  nextHint: string;
  fulfillmentStage: FulfillmentStage;
  packageCount: number;
  openShippingInvoiceId: string | null;
};

function stepMeta(key: AccountOrderStatusKey): AccountOrderStatusStep {
  return (
    ACCOUNT_ORDER_STATUS_STEPS.find((step) => step.key === key) || {
      key,
      title: key.replace(/_/g, ' '),
      description: '',
    }
  );
}

function nextHintFor(key: AccountOrderStatusKey): string {
  switch (key) {
    case 'awaiting_payment':
      return 'Open your invoice and pay the product total.';
    case 'payment_sent':
      return 'Hang tight while Snappy confirms your product payment.';
    case 'payment_confirmed':
      return 'Snappy will move this order into sourcing in China.';
    case 'sourcing':
      return 'Goods are being prepared. Packaging comes next.';
    case 'needs_packing':
      return 'Warehouse will create your shipping package soon.';
    case 'received_at_warehouse':
      return 'Open My Shipments for CBM and freight details.';
    case 'in_transit':
      return 'Track arrival timing under My Shipments.';
    case 'arrived_in_ghana':
      return 'Shipping bill will appear when Snappy locks the rate.';
    case 'waiting_for_payment':
      return 'Pay the shipping bill, then tap I\'ve paid on Invoices.';
    case 'payment_check':
      return 'Snappy will confirm after checking the bank or MoMo account.';
    case 'release_goods':
      return 'Almost there. Snappy will mark this ready for pickup or delivery.';
    case 'ready_for_you':
      return 'Book delivery or arrange store pickup.';
    case 'delivered':
      return 'This import is complete.';
    case 'cancelled':
      return 'This order was cancelled.';
    default:
      return '';
  }
}

function packageProgressKey(packages: AccountOrderPackageSummary[]): AccountOrderStatusKey | null {
  if (!packages.length) return null;

  const indexes = packages.map((pkg) => shippingStatusIndex(pkg.status));
  const allAtLeast = (status: string) =>
    indexes.every((index) => index >= shippingStatusIndex(status));
  const anyAtLeast = (status: string) =>
    indexes.some((index) => index >= shippingStatusIndex(status));

  if (allAtLeast('delivered')) return 'delivered';
  if (allAtLeast('ready')) return 'ready_for_you';

  const ghanaPackages = packages.filter((pkg) =>
    ['arrived', 'clearing'].includes(pkg.status),
  );
  if (allAtLeast('arrived') || ghanaPackages.length === packages.length) {
    const billable = packages.filter((pkg) => !pkg.freight_included);
    if (!billable.length) return 'release_goods';

    if (billable.some((pkg) => pkg.shipping_payment_status === 'awaiting_confirmation')) {
      return 'payment_check';
    }
    if (
      billable.every(
        (pkg) =>
          pkg.shipping_payment_status === 'paid' ||
          Boolean(pkg.freight_included),
      )
    ) {
      return 'release_goods';
    }
    if (billable.some((pkg) => Boolean(pkg.final_usd_to_ghs))) {
      return 'waiting_for_payment';
    }
    return 'arrived_in_ghana';
  }

  if (anyAtLeast('in_transit')) return 'in_transit';
  if (anyAtLeast('received')) return 'received_at_warehouse';
  return 'received_at_warehouse';
}

export function deriveAccountOrderStatus(
  order: {
    status?: string;
    payment_status?: string;
    metadata?: Record<string, any> | null;
  },
  packages: AccountOrderPackageSummary[] = [],
  openShippingInvoiceId: string | null = null,
): AccountOrderStatusResult {
  const packageStatuses = packages.map((pkg) => pkg.status);
  const fulfillmentStage = deriveFulfillmentStage(order, packageStatuses);

  let key: AccountOrderStatusKey;
  if (fulfillmentStage === 'cancelled' || order.status === 'cancelled') {
    key = 'cancelled';
  } else if (order.payment_status !== 'paid') {
    key =
      order.payment_status === 'awaiting_confirmation' || order.metadata?.payment_sent_at
        ? 'payment_sent'
        : 'awaiting_payment';
  } else {
    const fromPackages = packageProgressKey(packages);
    if (fromPackages) {
      key = fromPackages;
    } else if (fulfillmentStage === 'sourcing') {
      // Admin started sourcing; no physical box yet. Next desk step is Needs packing.
      key = 'sourcing';
    } else if (
      fulfillmentStage === 'en_route_ghana' ||
      fulfillmentStage === 'in_ghana' ||
      fulfillmentStage === 'ready' ||
      fulfillmentStage === 'delivered'
    ) {
      // Metadata ahead of packages (rare); fall back to fulfillment wording.
      key =
        fulfillmentStage === 'en_route_ghana'
          ? 'in_transit'
          : fulfillmentStage === 'in_ghana'
            ? 'arrived_in_ghana'
            : fulfillmentStage === 'ready'
              ? 'ready_for_you'
              : 'delivered';
    } else if (fulfillmentStage === 'paid') {
      key = 'payment_confirmed';
    } else {
      key = 'sourcing';
    }
  }

  const meta = stepMeta(key);
  const showShippingInvoice = [
    'arrived_in_ghana',
    'waiting_for_payment',
    'payment_check',
    'release_goods',
  ].includes(key);

  return {
    key,
    title: meta.title,
    description: meta.description,
    nextHint: nextHintFor(key),
    fulfillmentStage,
    packageCount: packages.length,
    openShippingInvoiceId: showShippingInvoice ? openShippingInvoiceId : null,
  };
}

/** Visible timeline steps for one order (hides packing/shipping money steps until relevant). */
export function visibleAccountOrderStatusSteps(
  current: AccountOrderStatusKey,
  hasPackages: boolean,
  needsShippingBill: boolean,
): AccountOrderStatusStep[] {
  const keys = new Set<AccountOrderStatusKey>([
    'awaiting_payment',
    'payment_sent',
    'payment_confirmed',
    'sourcing',
  ]);

  if (hasPackages || ['needs_packing', 'received_at_warehouse', 'in_transit', 'arrived_in_ghana', 'waiting_for_payment', 'payment_check', 'release_goods', 'ready_for_you', 'delivered'].includes(current)) {
    keys.add('needs_packing');
    keys.add('received_at_warehouse');
    keys.add('in_transit');
    keys.add('arrived_in_ghana');
  } else if (current === 'needs_packing' || current === 'sourcing') {
    keys.add('needs_packing');
  }

  if (
    needsShippingBill ||
    ['waiting_for_payment', 'payment_check', 'release_goods'].includes(current)
  ) {
    keys.add('waiting_for_payment');
    keys.add('payment_check');
    keys.add('release_goods');
  }

  keys.add('ready_for_you');
  keys.add('delivered');

  if (current === 'cancelled') {
    return [
      {
        key: 'cancelled',
        title: 'Cancelled',
        description: 'This order was cancelled.',
      },
    ];
  }

  return ACCOUNT_ORDER_STATUS_STEPS.filter((step) => keys.has(step.key));
}

export function accountOrderStatusIndex(key: AccountOrderStatusKey): number {
  if (key === 'cancelled') return -1;
  return ACCOUNT_ORDER_STATUS_STEPS.findIndex((step) => step.key === key);
}

export type AccountRmbStatusKey =
  | 'awaiting_payment'
  | 'payment_sent'
  | 'confirmed'
  | 'completed'
  | 'expired';

export const ACCOUNT_RMB_STATUS_STEPS: Array<{
  key: AccountRmbStatusKey;
  title: string;
  description: string;
}> = [
  {
    key: 'awaiting_payment',
    title: 'Awaiting payment',
    description: 'Your Buy RMB invoice is open. Pay to lock this rate.',
  },
  {
    key: 'payment_sent',
    title: 'Payment sent',
    description: 'You marked payment as sent. Snappy is confirming it.',
  },
  {
    key: 'confirmed',
    title: 'Sending your RMB',
    description: 'Payment confirmed. Snappy is sending your RMB.',
  },
  {
    key: 'completed',
    title: 'RMB sent',
    description: 'Your Buy RMB request is complete.',
  },
];

export function deriveAccountRmbStatus(exchange: {
  status?: string;
}): {
  key: AccountRmbStatusKey;
  title: string;
  description: string;
  nextHint: string;
} {
  const raw = String(exchange.status || 'awaiting_payment');
  const key = (
    ['awaiting_payment', 'payment_sent', 'confirmed', 'completed', 'expired'].includes(raw)
      ? raw
      : 'awaiting_payment'
  ) as AccountRmbStatusKey;

  if (key === 'expired') {
    return {
      key,
      title: 'Expired',
      description: 'This Buy RMB rate lock expired.',
      nextHint: 'Start a new Buy RMB request if you still need RMB.',
    };
  }

  const step =
    ACCOUNT_RMB_STATUS_STEPS.find((entry) => entry.key === key) || ACCOUNT_RMB_STATUS_STEPS[0];
  const nextHint =
    key === 'awaiting_payment'
      ? 'Open the invoice and pay, then tap I\'ve paid.'
      : key === 'payment_sent'
        ? 'Hang tight while Snappy confirms your transfer.'
        : key === 'confirmed'
          ? 'Your RMB is being sent.'
          : 'This Buy RMB request is finished.';

  return {
    key,
    title: step.title,
    description: step.description,
    nextHint,
  };
}

export function accountRmbStatusIndex(key: AccountRmbStatusKey): number {
  if (key === 'expired') return -1;
  return ACCOUNT_RMB_STATUS_STEPS.findIndex((step) => step.key === key);
}

/** Distinct badge / timeline colors so each status reads differently at a glance. */
export type AccountStatusTone = {
  badge: string;
  dot: string;
  title: string;
  label: string;
  panel: string;
};

const TONE = {
  slate: {
    badge: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
    dot: 'bg-slate-500 ring-4 ring-slate-500/20',
    title: 'text-slate-800',
    label: 'text-slate-600',
    panel: 'bg-slate-50 ring-1 ring-slate-200',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-900 ring-1 ring-amber-200',
    dot: 'bg-amber-500 ring-4 ring-amber-500/20',
    title: 'text-amber-950',
    label: 'text-amber-800',
    panel: 'bg-amber-50/80 ring-1 ring-amber-200',
  },
  sky: {
    badge: 'bg-sky-50 text-sky-900 ring-1 ring-sky-200',
    dot: 'bg-sky-500 ring-4 ring-sky-500/20',
    title: 'text-sky-950',
    label: 'text-sky-800',
    panel: 'bg-sky-50/80 ring-1 ring-sky-200',
  },
  blue: {
    badge: 'bg-blue-50 text-blue-900 ring-1 ring-blue-200',
    dot: 'bg-blue-600 ring-4 ring-blue-600/20',
    title: 'text-blue-950',
    label: 'text-blue-800',
    panel: 'bg-blue-50/80 ring-1 ring-blue-200',
  },
  teal: {
    badge: 'bg-teal-50 text-teal-900 ring-1 ring-teal-200',
    dot: 'bg-teal-600 ring-4 ring-teal-600/20',
    title: 'text-teal-950',
    label: 'text-teal-800',
    panel: 'bg-teal-50/80 ring-1 ring-teal-200',
  },
  cyan: {
    badge: 'bg-cyan-50 text-cyan-900 ring-1 ring-cyan-200',
    dot: 'bg-cyan-600 ring-4 ring-cyan-600/20',
    title: 'text-cyan-950',
    label: 'text-cyan-800',
    panel: 'bg-cyan-50/80 ring-1 ring-cyan-200',
  },
  indigo: {
    badge: 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200',
    dot: 'bg-indigo-600 ring-4 ring-indigo-600/20',
    title: 'text-indigo-950',
    label: 'text-indigo-800',
    panel: 'bg-indigo-50/80 ring-1 ring-indigo-200',
  },
  orange: {
    badge: 'bg-orange-50 text-orange-900 ring-1 ring-orange-200',
    dot: 'bg-orange-500 ring-4 ring-orange-500/20',
    title: 'text-orange-950',
    label: 'text-orange-800',
    panel: 'bg-orange-50/80 ring-1 ring-orange-200',
  },
  yellow: {
    badge: 'bg-yellow-50 text-yellow-950 ring-1 ring-yellow-300',
    dot: 'bg-yellow-500 ring-4 ring-yellow-500/25',
    title: 'text-yellow-950',
    label: 'text-yellow-900',
    panel: 'bg-yellow-50/90 ring-1 ring-yellow-200',
  },
  lime: {
    badge: 'bg-lime-50 text-lime-900 ring-1 ring-lime-200',
    dot: 'bg-lime-600 ring-4 ring-lime-600/20',
    title: 'text-lime-950',
    label: 'text-lime-800',
    panel: 'bg-lime-50/80 ring-1 ring-lime-200',
  },
  emerald: {
    badge: 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200',
    dot: 'bg-emerald-600 ring-4 ring-emerald-600/20',
    title: 'text-emerald-950',
    label: 'text-emerald-800',
    panel: 'bg-emerald-50/80 ring-1 ring-emerald-200',
  },
  green: {
    badge: 'bg-green-50 text-green-900 ring-1 ring-green-200',
    dot: 'bg-green-600 ring-4 ring-green-600/20',
    title: 'text-green-950',
    label: 'text-green-800',
    panel: 'bg-green-50/80 ring-1 ring-green-200',
  },
  red: {
    badge: 'bg-red-50 text-red-800 ring-1 ring-red-200',
    dot: 'bg-red-500 ring-4 ring-red-500/20',
    title: 'text-red-900',
    label: 'text-red-700',
    panel: 'bg-red-50/80 ring-1 ring-red-200',
  },
} as const satisfies Record<string, AccountStatusTone>;

export function accountOrderStatusTone(key: AccountOrderStatusKey): AccountStatusTone {
  switch (key) {
    case 'awaiting_payment':
      return TONE.amber;
    case 'payment_sent':
      return TONE.yellow;
    case 'payment_confirmed':
      return TONE.sky;
    case 'sourcing':
      return TONE.indigo;
    case 'needs_packing':
      return TONE.blue;
    case 'received_at_warehouse':
      return TONE.teal;
    case 'in_transit':
      return TONE.cyan;
    case 'arrived_in_ghana':
      return TONE.emerald;
    case 'waiting_for_payment':
      return TONE.orange;
    case 'payment_check':
      return TONE.yellow;
    case 'release_goods':
      return TONE.lime;
    case 'ready_for_you':
      return TONE.green;
    case 'delivered':
      return TONE.emerald;
    case 'cancelled':
      return TONE.red;
    default:
      return TONE.slate;
  }
}

export function accountRmbStatusTone(key: AccountRmbStatusKey): AccountStatusTone {
  switch (key) {
    case 'awaiting_payment':
      return TONE.amber;
    case 'payment_sent':
      return TONE.yellow;
    case 'confirmed':
      return TONE.indigo;
    case 'completed':
      return TONE.emerald;
    case 'expired':
      return TONE.red;
    default:
      return TONE.slate;
  }
}

export function isPastShopOrder(order: {
  status?: string;
}): boolean {
  return order.status === 'delivered' || order.status === 'cancelled';
}

export function isPastRmbOrder(exchange: { status?: string }): boolean {
  return exchange.status === 'completed' || exchange.status === 'expired';
}
