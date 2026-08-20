'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  calculateCbm,
  calculateShipping,
  formatGhs,
  formatUsd,
  previousPackageStatus,
  rateForClass,
  SHIPPING_CLASS_LABELS,
  SHIPPING_GOODS_CLASSES,
  SHIPPING_STATUS_LABELS,
  type ShippingGoodsClass,
  type ShippingPackageStatus,
} from '@/lib/shipping';

type Queue =
  | 'pack'
  | 'load'
  | 'transit'
  | 'billing'
  | 'awaiting_payment'
  | 'confirm'
  | 'release'
  | 'ready'
  | 'all';
type WorkspaceMode = 'packages' | 'shipping';

const emptyBuilder = {
  packageName: '',
  quantities: {} as Record<string, string>,
  goodsClass: 'normal' as ShippingGoodsClass,
  customUsdPerCbm: '',
  lengthM: '',
  widthM: '',
  heightM: '',
  cbm: '',
  receivedAt: new Date().toISOString().slice(0, 16),
  carrierReference: '',
  notes: '',
};

function customerName(order: any) {
  return (
    [order?.shipping_address?.firstName, order?.shipping_address?.lastName]
      .filter(Boolean)
      .join(' ') ||
    order?.email ||
    'Customer'
  );
}

function customerKey(order: any) {
  return order?.user_id
    ? `user:${order.user_id}`
    : `email:${String(order?.email || '').trim().toLowerCase()}`;
}

function packageOrders(pkg: any) {
  return [
    ...new Set(
      (pkg.shipping_package_items || [])
        .map((entry: any) => entry.order_items?.orders?.order_number)
        .filter(Boolean),
    ),
  ];
}

function packageCustomer(pkg: any) {
  return (pkg.shipping_package_items || []).find(
    (entry: any) => entry.order_items?.orders,
  )?.order_items?.orders;
}

function contents(pkg: any) {
  return (pkg.shipping_package_items || [])
    .map((entry: any) => {
      const item = entry.order_items;
      const orderNumber = item?.orders?.order_number;
      return `${item?.product_name || 'Item'} × ${entry.quantity}${
        orderNumber ? ` (${orderNumber})` : ''
      }`;
    })
    .join(', ');
}

function itemFreightIncluded(item: any) {
  const importType = String(item?.metadata?.import_type || item?.products?.metadata?.import_type || '');
  return importType === 'cif_tema' || importType === 'ddp';
}

export default function ShippingOperationsDesk({
  mode = 'shipping',
}: {
  mode?: WorkspaceMode;
}) {
  const [data, setData] = useState<any>({ orders: [], packages: [], board: null });
  const [queue, setQueue] = useState<Queue>(mode === 'packages' ? 'pack' : 'load');
  const [selected, setSelected] = useState<string[]>([]);
  const [builderCustomerKey, setBuilderCustomerKey] = useState('');
  const [builder, setBuilder] = useState(emptyBuilder);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [vessel, setVessel] = useState('');
  const [loadedAt, setLoadedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [transitDays, setTransitDays] = useState('45');
  const [arrivalRate, setArrivalRate] = useState('');
  const [validDays, setValidDays] = useState('5');
  const [undoPackageIds, setUndoPackageIds] = useState<string[]>([]);
  const [correctionPackage, setCorrectionPackage] = useState<any | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [repackPackage, setRepackPackage] = useState<any | null>(null);
  const [repackReason, setRepackReason] = useState('');

  const headers = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      ...(sessionData.session?.access_token
        ? { Authorization: `Bearer ${sessionData.session.access_token}` }
        : {}),
    };
  };

  const load = async () => {
    const response = await fetch('/api/shipping/desk', { headers: await headers() });
    const result = await response.json();
    if (response.ok) {
      setData(result);
      setTransitDays(String(result.board?.default_transit_days || 45));
      setArrivalRate(String(result.board?.usd_to_ghs || ''));
      setValidDays(String(result.board?.invoice_valid_days || 5));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allocated = useMemo(() => {
    const totals = new Map<string, number>();
    for (const pkg of data.packages || []) {
      for (const entry of pkg.shipping_package_items || []) {
        totals.set(
          entry.order_item_id,
          (totals.get(entry.order_item_id) || 0) + Number(entry.quantity || 0),
        );
      }
    }
    return totals;
  }, [data.packages]);

  const packOrders = useMemo(
    () =>
      (data.orders || [])
        .map((order: any) => ({
          ...order,
          unpackedItems: (order.order_items || [])
            .map((item: any) => ({
              ...item,
              remaining: Math.max(0, Number(item.quantity) - (allocated.get(item.id) || 0)),
            }))
            .filter((item: any) => item.remaining > 0),
        }))
        .filter((order: any) => order.unpackedItems.length > 0),
    [allocated, data.orders],
  );

  const packCustomers = useMemo(() => {
    const grouped = new Map<string, any>();
    for (const order of packOrders) {
      const key = customerKey(order);
      const current = grouped.get(key) || {
        key,
        customer: order,
        orders: [],
        unpackedItems: [],
      };
      current.orders.push(order);
      current.unpackedItems.push(
        ...order.unpackedItems.map((item: any) => ({
          ...item,
          orderId: order.id,
          orderNumber: order.order_number,
        })),
      );
      grouped.set(key, current);
    }
    return [...grouped.values()];
  }, [packOrders]);

  const packageQueues = useMemo(() => {
    const packages = data.packages || [];
    return {
      all: packages,
      load: packages.filter((pkg: any) => pkg.status === 'received'),
      transit: packages.filter((pkg: any) => ['loaded', 'in_transit'].includes(pkg.status)),
      billing: packages.filter(
        (pkg: any) =>
          ['arrived', 'clearing'].includes(pkg.status) &&
          !pkg.freight_included &&
          !pkg.final_usd_to_ghs,
      ),
      awaiting_payment: packages.filter(
        (pkg: any) =>
          ['arrived', 'clearing'].includes(pkg.status) &&
          !pkg.freight_included &&
          Boolean(pkg.final_usd_to_ghs) &&
          pkg.shipping_payment_status === 'unpaid',
      ),
      confirm: packages.filter((pkg: any) => pkg.shipping_payment_status === 'awaiting_confirmation'),
      release: packages.filter(
        (pkg: any) =>
          ['arrived', 'clearing'].includes(pkg.status) &&
          (pkg.shipping_payment_status === 'paid' || pkg.freight_included),
      ),
      ready: packages.filter((pkg: any) => pkg.status === 'ready'),
    } as Record<Exclude<Queue, 'pack'>, any[]>;
  }, [data.packages]);

  const counts: Record<Queue, number> = {
    pack: packCustomers.length,
    load: packageQueues.load.length,
    transit: packageQueues.transit.length,
    billing: packageQueues.billing.length,
    awaiting_payment: packageQueues.awaiting_payment.length,
    confirm: packageQueues.confirm.length,
    release: packageQueues.release.length,
    ready: packageQueues.ready.length,
    all: packageQueues.all.length,
  };
  const rows = queue === 'pack' ? [] : packageQueues[queue];
  const builderCustomer = packCustomers.find((customer: any) => customer.key === builderCustomerKey);
  const selectedBuilderItems = (builderCustomer?.unpackedItems || []).filter(
    (item: any) => Number(builder.quantities[item.id]) > 0,
  );
  const terms = new Set(selectedBuilderItems.map(itemFreightIncluded));
  const mixedTerms = terms.size > 1;
  const freightIncluded = terms.size === 1 && terms.has(true);
  const classRate =
    builder.goodsClass === 'custom'
      ? Number(builder.customUsdPerCbm) || 0
      : data.board
        ? rateForClass(data.board, builder.goodsClass)
        : 0;
  const measuredCbm = calculateCbm(
    Number(builder.lengthM) || 0,
    Number(builder.widthM) || 0,
    Number(builder.heightM) || 0,
    1,
  );
  const cbm = measuredCbm || Number(builder.cbm) || 0;
  const preview = calculateShipping(cbm, freightIncluded ? 0 : classRate, data.board?.usd_to_ghs);

  const openBuilder = (customer: any) => {
    const key = customer.key;
    const packageCount = (data.packages || []).filter((pkg: any) => {
      if (key.startsWith('user:')) return pkg.customer_user_id === key.slice(5);
      return String(pkg.customer_email || '').toLowerCase() === key.slice(6);
    }).length;
    setBuilderCustomerKey(key);
    setBuilder({
      ...emptyBuilder,
      receivedAt: new Date().toISOString().slice(0, 16),
      packageName: `${customerName(customer.customer)} Package ${packageCount + 1}`,
    });
    setError('');
  };

  const createPackage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!builderCustomer) return;
    if (!selectedBuilderItems.length) return setError('Choose what is inside this package.');
    if (mixedTerms) {
      return setError(
        'Freight included items need a separate package from items that need a CBM bill.',
      );
    }
    if (!(cbm > 0)) return setError('Enter the package dimensions or total CBM.');

    setBusy(true);
    setError('');
    const response = await fetch('/api/shipping/desk', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({
        action: 'create_package',
        packageName: builder.packageName,
        items: selectedBuilderItems.map((item: any) => ({
          orderItemId: item.id,
          quantity: Number(builder.quantities[item.id]),
        })),
        goodsClass: builder.goodsClass,
        customUsdPerCbm: builder.customUsdPerCbm,
        lengthM: builder.lengthM,
        widthM: builder.widthM,
        heightM: builder.heightM,
        cbm,
        receivedAt: builder.receivedAt,
        carrierReference: builder.carrierReference,
        notes: builder.notes,
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setError(result.error || 'Could not create the package.');
    setBuilderCustomerKey('');
    setBuilder(emptyBuilder);
    await load();
  };

  const runBatch = async (
    action:
      | 'mark_in_transit'
      | 'lock_arrival'
      | 'confirm_shipping_payment'
      | 'mark_ready'
      | 'mark_delivered',
  ) => {
    if (!selected.length) return;
    let prompt = `Update ${selected.length} package${selected.length === 1 ? '' : 's'}?`;
    if (action === 'lock_arrival') {
      const totalUsd = rows
        .filter((pkg: any) => selected.includes(pkg.id) && !pkg.freight_included)
        .reduce((sum: number, pkg: any) => sum + Number(pkg.estimated_shipping_usd || 0), 0);
      prompt = `Lock ${selected.length} bill${selected.length === 1 ? '' : 's'} at GH¢${Number(arrivalRate).toFixed(2)} per $1? The freight total is ${formatUsd(totalUsd)}.`;
    }
    if (action === 'confirm_shipping_payment') {
      const total = rows
        .filter((pkg: any) => selected.includes(pkg.id))
        .reduce((sum: number, pkg: any) => sum + Number(pkg.final_shipping_ghs || 0), 0);
      prompt = `Confirm ${selected.length} shipping payment${selected.length === 1 ? '' : 's'} totalling ${formatGhs(total)}? Check the bank or MoMo account first.`;
    }
    if (!confirm(prompt)) return;

    setBusy(true);
    try {
      const response = await fetch('/api/shipping/desk', {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify({
          action,
          packageIds: selected,
          vessel,
          loadedAt,
          transitDays: Number(transitDays),
          finalUsdToGhs: Number(arrivalRate),
          validDays: Number(validDays),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        alert(result.error || 'Could not update packages.');
        return;
      }
      if (action === 'lock_arrival') {
        const locked = Number(result.issued || 0) + Number(result.included || 0);
        if (locked > 0) {
          alert(
            locked === 1
              ? 'Shipping bill locked. The package moved to Waiting for payment.'
              : `${locked} shipping bills locked.`,
          );
        }
        if (Array.isArray(result.failures) && result.failures.length) {
          alert(result.failures.join('\n'));
        }
      }
      if (action === 'confirm_shipping_payment' && result.confirmed > 0) {
        setUndoPackageIds([...selected]);
        window.setTimeout(() => setUndoPackageIds([]), 120_000);
      }
      setSelected([]);
      await load();
      if (action === 'confirm_shipping_payment') {
        window.setTimeout(async () => {
          void fetch('/api/cron/receipt-outbox', { method: 'POST', headers: await headers() });
        }, 125_000);
      }
    } catch (err) {
      console.error('[shipping batch]', err);
      alert('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const undoShippingPayments = async () => {
    if (!undoPackageIds.length) return;
    setBusy(true);
    const response = await fetch('/api/shipping/desk', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({ action: 'undo_shipping_payment', packageIds: undoPackageIds }),
    });
    setBusy(false);
    setUndoPackageIds([]);
    if (!response.ok) return alert('The undo window has closed.');
    await load();
  };

  const markAwaitingConfirmation = async () => {
    if (!selected.length) return;
    if (
      !confirm(
        `Move ${selected.length} package${selected.length === 1 ? '' : 's'} to Payment check? Use this when the customer paid by WhatsApp or MoMo and told you directly.`,
      )
    ) {
      return;
    }

    setBusy(true);
    const response = await fetch('/api/shipping/desk', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({
        action: 'mark_awaiting_confirmation',
        packageIds: selected,
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return alert(result.error || 'Could not update packages.');
    setSelected([]);
    await load();
  };

  const repackToPackages = async () => {
    if (!repackPackage) return;
    if (repackReason.trim().length < 5) {
      return setError('Enter a short reason for sending this package back.');
    }

    setBusy(true);
    setError('');
    const response = await fetch('/api/shipping/desk', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({
        action: 'repack_to_packages',
        packageIds: [repackPackage.id],
        reason: repackReason.trim(),
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setError(result.error || 'Could not repack this package.');
    setRepackPackage(null);
    setRepackReason('');
    setSelected([]);
    alert(
      `${repackPackage.package_name} went back to Needs packing. Edit CBM there, then create a fresh box.`,
    );
    await load();
  };

  const correctPackageStatus = async () => {
    if (!correctionPackage) return;
    const previousStatus = previousPackageStatus(correctionPackage.status);
    if (!previousStatus || correctionReason.trim().length < 5) {
      return setError('Enter a short reason for the correction.');
    }

    setBusy(true);
    setError('');
    const response = await fetch('/api/shipping/desk', {
      method: 'POST',
      headers: await headers(),
      body: JSON.stringify({
        action: 'correct_status',
        packageIds: [correctionPackage.id],
        reason: correctionReason.trim(),
      }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return setError(result.error || 'Could not correct the package status.');
    setCorrectionPackage(null);
    setCorrectionReason('');
    setSelected([]);
    await load();
  };

  const toggleAll = () => {
    const ids = rows.map((row: any) => row.id);
    setSelected(selected.length === ids.length ? [] : ids);
  };

  const queueMeta: Record<Queue, { label: string; hint: string }> = {
    pack: { label: 'Needs packing', hint: 'Paid items waiting for a physical box.' },
    load: { label: 'Received at warehouse', hint: 'Packed boxes still in China. Repack here if CBM was wrong.' },
    transit: { label: 'In transit', hint: 'On the vessel to Ghana.' },
    billing: { label: 'Arrived in Ghana', hint: 'Goods landed. Lock the shipping bill.' },
    awaiting_payment: {
      label: 'Waiting for payment',
      hint: 'Bill locked. Customer has not marked payment yet.',
    },
    confirm: { label: 'Payment check', hint: 'Customer says they paid. Confirm in bank or MoMo.' },
    release: { label: 'Release goods', hint: 'Freight cleared. Mark ready for pickup or delivery.' },
    ready: { label: 'Ready for customer', hint: 'Waiting for collection or delivery booking.' },
    all: { label: 'All packages', hint: 'Every shipping package in the system.' },
  };

  const queueLabels: { key: Queue; label: string }[] =
    mode === 'packages'
      ? [{ key: 'pack', label: queueMeta.pack.label }]
      : [
          { key: 'load', label: queueMeta.load.label },
          { key: 'transit', label: queueMeta.transit.label },
          { key: 'billing', label: queueMeta.billing.label },
          { key: 'awaiting_payment', label: queueMeta.awaiting_payment.label },
          { key: 'confirm', label: queueMeta.confirm.label },
          { key: 'release', label: queueMeta.release.label },
          { key: 'all', label: queueMeta.all.label },
        ];
  const visibleJobCount = queueLabels
    .filter((tab) => tab.key !== 'all')
    .reduce((sum, tab) => sum + counts[tab.key], 0);

  if (loading) {
    return (
      <p className="rounded-2xl bg-white p-6 text-slate-500">
        Loading {mode === 'packages' ? 'package work' : 'shipping work'}…
      </p>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-bold text-brand-primary">
              {mode === 'packages' ? 'Create packages' : 'Shipping operations'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {mode === 'packages'
                ? 'Choose one customer, then combine unpacked items from any of their paid orders.'
                : 'Move completed packages, lock arrival bills, confirm payment, and release goods.'}
            </p>
          </div>
          <p className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-800">
            {visibleJobCount} jobs
          </p>
        </div>
        {mode === 'shipping' ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {queueLabels.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setQueue(tab.key);
                  setSelected([]);
                  setBuilderCustomerKey('');
                }}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold ${
                  queue === tab.key
                    ? 'bg-brand-primary text-white'
                    : 'border border-slate-200 text-slate-600'
                }`}
              >
                {tab.label} {counts[tab.key]}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs font-semibold text-slate-500">
            {counts.pack} customer{counts.pack === 1 ? '' : 's'} with items waiting to be packed
          </p>
        )}
        {mode === 'shipping' && queue !== 'pack' ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{queueMeta[queue].hint}</p>
        ) : null}
      </div>

      {undoPackageIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-5 py-3">
          <p className="text-sm font-semibold text-emerald-900">
            Payment confirmed. The receipt email waits 2 minutes.
          </p>
          <button
            type="button"
            onClick={() => void undoShippingPayments()}
            disabled={busy}
            className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800"
          >
            Undo confirmation
          </button>
        </div>
      ) : null}

      {queue === 'pack' ? (
        <div className="divide-y divide-slate-100">
          {packCustomers.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-400">Every paid item is packed.</p>
          ) : (
            packCustomers.map((customer: any) => (
              <div key={customer.key} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {customerName(customer.customer)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {customer.orders.map((order: any) => order.order_number).join(', ')}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {customer.unpackedItems
                        .map((item: any) => `${item.product_name} × ${item.remaining}`)
                        .join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      builderCustomerKey === customer.key
                        ? setBuilderCustomerKey('')
                        : openBuilder(customer)
                    }
                    className="rounded-lg bg-brand-primary px-4 py-2 text-xs font-bold text-white"
                  >
                    {builderCustomerKey === customer.key ? 'Close' : 'Create package'}
                  </button>
                </div>

                {builderCustomerKey === customer.key ? (
                  <form onSubmit={createPackage} className="mt-4 space-y-4 rounded-xl bg-slate-50 p-4">
                    <div>
                      <p className="text-sm font-bold text-slate-900">1. What is inside this box?</p>
                      <p className="text-xs text-slate-500">
                        Enter how many of each unpacked item went into this physical package.
                      </p>
                      <div className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                        {customer.unpackedItems.map((item: any) => (
                          <label
                            key={item.id}
                            className="flex items-center justify-between gap-3 px-3 py-2.5"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-900">
                                {item.product_name}
                              </span>
                              <span className="text-xs text-slate-500">
                                {item.orderNumber}. {item.remaining} unpacked
                                {itemFreightIncluded(item) ? '. Freight included' : ''}
                              </span>
                            </span>
                            <input
                              type="number"
                              min="0"
                              max={item.remaining}
                              step="1"
                              value={builder.quantities[item.id] || ''}
                              onChange={(event) =>
                                setBuilder((current) => ({
                                  ...current,
                                  quantities: {
                                    ...current.quantities,
                                    [item.id]: event.target.value,
                                  },
                                }))
                              }
                              placeholder="0"
                              className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-600">
                        Package name
                        <input
                          value={builder.packageName}
                          onChange={(event) =>
                            setBuilder((current) => ({
                              ...current,
                              packageName: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5"
                        />
                        <span className="mt-1 block font-normal text-slate-400">
                          Snappy creates the permanent SHP number automatically.
                        </span>
                      </label>
                      <label className="text-xs font-semibold text-slate-600">
                        Shipping company reference
                        <input
                          value={builder.carrierReference}
                          onChange={(event) =>
                            setBuilder((current) => ({
                              ...current,
                              carrierReference: event.target.value,
                            }))
                          }
                          placeholder="Optional warehouse or carrier number"
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5"
                        />
                      </label>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-900">2. Measure this package</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          ['lengthM', 'Length (m)'],
                          ['widthM', 'Width (m)'],
                          ['heightM', 'Height (m)'],
                        ].map(([key, label]) => (
                          <label key={key} className="text-xs font-semibold text-slate-600">
                            {label}
                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={builder[key as 'lengthM' | 'widthM' | 'heightM']}
                              onChange={(event) =>
                                setBuilder((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                            />
                          </label>
                        ))}
                        <label className="text-xs font-semibold text-slate-600">
                          Or total CBM
                          <input
                            type="number"
                            min="0.0001"
                            step="0.0001"
                            value={builder.cbm}
                            onChange={(event) =>
                              setBuilder((current) => ({ ...current, cbm: event.target.value }))
                            }
                            disabled={measuredCbm > 0}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:bg-slate-100"
                          />
                        </label>
                      </div>
                    </div>

                    {!freightIncluded ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-600">
                          Goods class
                          <select
                            value={builder.goodsClass}
                            onChange={(event) =>
                              setBuilder((current) => ({
                                ...current,
                                goodsClass: event.target.value as ShippingGoodsClass,
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5"
                          >
                            {SHIPPING_GOODS_CLASSES.map((key) => (
                              <option key={key} value={key}>
                                {SHIPPING_CLASS_LABELS[key]}
                              </option>
                            ))}
                          </select>
                        </label>
                        {builder.goodsClass === 'custom' ? (
                          <label className="text-xs font-semibold text-slate-600">
                            Dollars per CBM
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={builder.customUsdPerCbm}
                              onChange={(event) =>
                                setBuilder((current) => ({
                                  ...current,
                                  customUsdPerCbm: event.target.value,
                                }))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5"
                            />
                          </label>
                        ) : null}
                      </div>
                    ) : null}

                    <div
                      className={`rounded-xl px-3 py-3 text-sm ${
                        mixedTerms
                          ? 'bg-red-50 text-red-700'
                          : freightIncluded
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-brand-light/60 text-brand-primary'
                      }`}
                    >
                      {mixedTerms ? (
                        <p>
                          Separate these items. Some already include freight and some need a CBM
                          bill.
                        </p>
                      ) : freightIncluded ? (
                        <p className="font-semibold">Freight is included. Track this package only.</p>
                      ) : (
                        <p className="font-semibold">
                          {cbm.toFixed(3)} CBM × {formatUsd(classRate)} ={' '}
                          {formatUsd(preview.shippingUsd)}
                          {preview.shippingGhs != null
                            ? `. About ${formatGhs(preview.shippingGhs)} today.`
                            : ''}
                        </p>
                      )}
                    </div>

                    {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
                    <button
                      type="submit"
                      disabled={busy || mixedTerms}
                      className="rounded-lg bg-brand-primary px-5 py-3 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {busy ? 'Creating…' : 'Create package'}
                    </button>
                  </form>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          {selected.length > 0 ? (
            <div className="flex flex-wrap items-end gap-3 border-b border-brand-primary/10 bg-brand-light/40 p-4">
              <p className="self-center text-sm font-bold text-brand-primary">{selected.length} selected</p>
              {queue === 'load' ? (
                <>
                  <label className="text-xs font-semibold text-slate-600">
                    Vessel or container
                    <input
                      value={vessel}
                      onChange={(event) => setVessel(event.target.value)}
                      className="mt-1 block rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Loaded
                    <input
                      type="datetime-local"
                      value={loadedAt}
                      onChange={(event) => setLoadedAt(event.target.value)}
                      className="mt-1 block rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Days to Ghana
                    <input
                      value={transitDays}
                      onChange={(event) => setTransitDays(event.target.value)}
                      className="mt-1 block w-24 rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <button
                    onClick={() => void runBatch('mark_in_transit')}
                    disabled={busy}
                    className="rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-bold text-white"
                  >
                    Mark in transit
                  </button>
                </>
              ) : queue === 'transit' || queue === 'billing' ? (
                <>
                  <label className="text-xs font-semibold text-slate-600">
                    Arrival day USD to GHS
                    <input
                      value={arrivalRate}
                      onChange={(event) => setArrivalRate(event.target.value)}
                      className="mt-1 block w-28 rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Bill valid days
                    <input
                      value={validDays}
                      onChange={(event) => setValidDays(event.target.value)}
                      className="mt-1 block w-24 rounded-lg border border-slate-200 px-3 py-2"
                    />
                  </label>
                  <button
                    onClick={() => void runBatch('lock_arrival')}
                    disabled={busy}
                    className="rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-bold text-white"
                  >
                    Arrived. Lock bills
                  </button>
                </>
              ) : queue === 'confirm' ? (
                <button
                  onClick={() => void runBatch('confirm_shipping_payment')}
                  disabled={busy}
                  className="rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white"
                >
                  Confirm payments
                </button>
              ) : queue === 'awaiting_payment' ? (
                <button
                  onClick={() => void markAwaitingConfirmation()}
                  disabled={busy}
                  className="rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-bold text-white"
                >
                  Customer paid (move to Payment check)
                </button>
              ) : queue === 'release' ? (
                <button
                  onClick={() => void runBatch('mark_ready')}
                  disabled={busy}
                  className="rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-bold text-white"
                >
                  Ready for pickup or delivery
                </button>
              ) : queue === 'ready' ? (
                <button
                  onClick={() => void runBatch('mark_delivered')}
                  disabled={busy}
                  className="rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white"
                >
                  Delivered or collected
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="p-3">
                    {queue !== 'all' ? (
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && selected.length === rows.length}
                        onChange={toggleAll}
                      />
                    ) : null}
                  </th>
                  <th className="p-3">Package</th>
                  <th className="p-3">Inside</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">CBM</th>
                  <th className="p-3">Freight</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-slate-400">
                      Nothing in this queue.
                    </td>
                  </tr>
                ) : (
                  rows.map((pkg: any) => (
                    <tr key={pkg.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        {queue !== 'all' ? (
                          <input
                            type="checkbox"
                            checked={selected.includes(pkg.id)}
                            onChange={() =>
                              setSelected((current) =>
                                current.includes(pkg.id)
                                  ? current.filter((id) => id !== pkg.id)
                                  : [...current, pkg.id],
                              )
                            }
                          />
                        ) : null}
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-slate-900">{pkg.package_name}</p>
                        <p className="font-mono text-[10px] text-slate-400">{pkg.tracking_id}</p>
                        {pkg.carrier_reference ? (
                          <p className="text-[10px] text-slate-400">
                            Carrier: {pkg.carrier_reference}
                          </p>
                        ) : null}
                      </td>
                      <td className="max-w-56 p-3 text-xs text-slate-600">
                        {contents(pkg) || 'No items recorded'}
                      </td>
                      <td className="p-3">
                        <p>{customerName(packageCustomer(pkg))}</p>
                        <p className="text-xs text-slate-400">
                          {packageOrders(pkg).join(', ')}
                        </p>
                      </td>
                      <td className="p-3 font-semibold">{Number(pkg.cbm).toFixed(3)}</td>
                      <td className="p-3 font-semibold text-brand-primary">
                        {pkg.freight_included
                          ? 'Included'
                          : pkg.final_shipping_ghs != null
                            ? formatGhs(pkg.final_shipping_ghs)
                            : formatUsd(pkg.estimated_shipping_usd)}
                      </td>
                      <td className="p-3">
                        <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-800">
                          {SHIPPING_STATUS_LABELS[pkg.status as ShippingPackageStatus]}
                        </span>
                        {data.canCorrectStatus && previousPackageStatus(pkg.status) ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCorrectionPackage(pkg);
                              setCorrectionReason('');
                              setError('');
                            }}
                            className="mt-2 block text-xs font-bold text-brand-primary underline decoration-brand-primary/30 underline-offset-2"
                          >
                            Fix status
                          </button>
                        ) : null}
                        {data.canRepack && pkg.status === 'received' && queue === 'load' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRepackPackage(pkg);
                              setRepackReason('');
                              setError('');
                            }}
                            className="mt-2 block text-xs font-bold text-amber-800 underline decoration-amber-300 underline-offset-2"
                          >
                            Send back to Packages
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {repackPackage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Send back to Packages</h3>
            <p className="mt-1 text-sm text-slate-500">
              {repackPackage.package_name} will be dissolved. Its items return to{' '}
              <strong>Needs packing</strong> so you can fix CBM, class, or freight before creating a
              new box.
            </p>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Why are you repacking it?
              <textarea
                value={repackReason}
                onChange={(event) => setRepackReason(event.target.value)}
                maxLength={300}
                rows={3}
                autoFocus
                placeholder="Example: CBM was measured wrong. Need to remeasure before shipping."
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
              />
            </label>
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRepackPackage(null);
                  setRepackReason('');
                  setError('');
                }}
                disabled={busy}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void repackToPackages()}
                disabled={busy || repackReason.trim().length < 5}
                className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? 'Repacking…' : 'Confirm repack'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {correctionPackage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Fix package status</h3>
            <p className="mt-1 text-sm text-slate-500">
              {correctionPackage.package_name} will move from{' '}
              <strong>
                {SHIPPING_STATUS_LABELS[
                  correctionPackage.status as ShippingPackageStatus
                ]}
              </strong>{' '}
              to{' '}
              <strong>
                {SHIPPING_STATUS_LABELS[
                  previousPackageStatus(
                    correctionPackage.status,
                  ) as ShippingPackageStatus
                ]}
              </strong>
              .
            </p>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Why are you correcting it?
              <textarea
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
                maxLength={300}
                rows={3}
                autoFocus
                placeholder="Example: Arrival was recorded on the wrong package."
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal"
              />
            </label>
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCorrectionPackage(null);
                  setCorrectionReason('');
                  setError('');
                }}
                disabled={busy}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void correctPackageStatus()}
                disabled={busy || correctionReason.trim().length < 5}
                className="rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? 'Correcting…' : 'Confirm correction'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
