import { supabaseAdmin } from '@/lib/supabase-admin';

export type FinancialFlow = 'shop' | 'rmb' | 'shipping';

function reference(prefix: string) {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

async function existingReceipt(flow: FinancialFlow, entityId: string) {
  const { data } = await supabaseAdmin
    .from('financial_documents')
    .select('*')
    .eq('flow', flow)
    .eq('entity_id', entityId)
    .eq('document_type', 'receipt')
    .neq('status', 'void')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function nextDocumentVersion(
  flow: FinancialFlow,
  entityId: string,
  documentType: 'invoice' | 'receipt',
) {
  const { data } = await supabaseAdmin
    .from('financial_documents')
    .select('version')
    .eq('flow', flow)
    .eq('entity_id', entityId)
    .eq('document_type', documentType)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.version || 0) + 1;
}

async function queueReceiptEmail({
  flow,
  entityId,
  receipt,
  delayMinutes,
}: {
  flow: FinancialFlow;
  entityId: string;
  receipt: any;
  delayMinutes: number;
}) {
  const email = String(receipt.customer_email || '').trim();
  if (!email.includes('@')) return;
  const labels: Record<FinancialFlow, string> = {
    shop: 'product order',
    rmb: 'Buy RMB order',
    shipping: 'shipping payment',
  };
  await supabaseAdmin.from('notification_outbox').upsert(
    {
      event_key: `${flow}-receipt:${entityId}`,
      kind: 'receipt_email',
      recipient: email,
      subject: `Payment confirmed. Receipt ${receipt.document_number}`,
      payload: {
        document_id: receipt.id,
        document_number: receipt.document_number,
        flow,
        label: labels[flow],
        amount: receipt.amount,
        currency: receipt.currency,
      },
      status: 'pending',
      send_after: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
      attempts: 0,
      last_error: null,
      sent_at: null,
    },
    { onConflict: 'event_key' },
  );
}

export async function createShopReceipt(order: any, createdBy?: string | null, delayMinutes = 2) {
  const current = await existingReceipt('shop', order.id);
  if (current) return current;
  const version = await nextDocumentVersion('shop', order.id, 'receipt');

  let items = order.order_items;
  if (!Array.isArray(items)) {
    const { data } = await supabaseAdmin
      .from('order_items')
      .select('product_name, variant_name, quantity, unit_price, total_price, metadata')
      .eq('order_id', order.id);
    items = data || [];
  }
  const issuedAt = order.metadata?.payment_confirmed_at || new Date().toISOString();
  const { data: receipt, error } = await supabaseAdmin
    .from('financial_documents')
    .insert({
      document_number: reference('RCT-ORD'),
      document_type: 'receipt',
      flow: 'shop',
      entity_id: order.id,
      order_id: order.id,
      customer_user_id: order.user_id || null,
      customer_email: order.email || null,
      currency: order.currency || 'GHS',
      amount: Number(order.total) || 0,
      status: 'paid',
      version,
      issued_at: issuedAt,
      paid_at: issuedAt,
      data: {
        reference: order.order_number,
        customer_name:
          [order.shipping_address?.firstName, order.shipping_address?.lastName]
            .filter(Boolean)
            .join(' ') || order.email,
        payment_method: order.payment_method || order.metadata?.payment_channel || 'Payment',
        items,
      },
      created_by: createdBy || null,
    })
    .select()
    .single();
  if (error || !receipt) throw error || new Error('Could not create order receipt.');
  await queueReceiptEmail({ flow: 'shop', entityId: order.id, receipt, delayMinutes });
  return receipt;
}

export async function createRmbReceipt(exchange: any, createdBy?: string | null, delayMinutes = 2) {
  const current = await existingReceipt('rmb', exchange.id);
  if (current) return current;
  const version = await nextDocumentVersion('rmb', exchange.id, 'receipt');
  const issuedAt = exchange.confirmed_at || new Date().toISOString();
  const { data: receipt, error } = await supabaseAdmin
    .from('financial_documents')
    .insert({
      document_number: reference('RCT-RMB'),
      document_type: 'receipt',
      flow: 'rmb',
      entity_id: exchange.id,
      exchange_order_id: exchange.id,
      customer_user_id: exchange.user_id || null,
      customer_email: exchange.email || null,
      currency: exchange.currency_from || 'GHS',
      amount: Number(exchange.amount_from) || 0,
      status: 'paid',
      version,
      issued_at: issuedAt,
      paid_at: issuedAt,
      data: {
        reference: exchange.exchange_number,
        customer_name: exchange.customer_name,
        amount_to: Number(exchange.amount_to) || 0,
        currency_to: 'RMB',
        rate: Number(exchange.rate) || 0,
        country_code: exchange.country_code || exchange.metadata?.country_code || 'GH',
      },
      created_by: createdBy || null,
    })
    .select()
    .single();
  if (error || !receipt) throw error || new Error('Could not create RMB receipt.');
  await queueReceiptEmail({ flow: 'rmb', entityId: exchange.id, receipt, delayMinutes });
  return receipt;
}

export async function issueShippingInvoice({
  pkg,
  finalUsdToGhs,
  validDays,
  createdBy,
}: {
  pkg: any;
  finalUsdToGhs: number;
  validDays: number;
  createdBy?: string | null;
}) {
  const now = new Date();
  const { data: packageItems } = await supabaseAdmin
    .from('shipping_package_items')
    .select(
      'quantity, order_items(order_id, product_name, variant_name, orders(id, order_number, email, user_id, shipping_address))',
    )
    .eq('package_id', pkg.id);
  const orders = Array.from(
    new Map(
      (packageItems || [])
        .map((entry: any) => entry.order_items?.orders)
        .filter(Boolean)
        .map((order: any) => [order.id, order]),
    ).values(),
  ) as any[];
  const primaryOrder = orders[0];
  if (!primaryOrder) throw new Error('A shipping package must contain at least one order item.');
  const orderNumbers = orders.map((order) => order.order_number).filter(Boolean);
  const customerEmail = pkg.customer_email || primaryOrder.email || null;
  const customerUserId = pkg.customer_user_id || primaryOrder.user_id || null;
  const contents = (packageItems || []).map((entry: any) => ({
    product_name: entry.order_items?.product_name || 'Order item',
    variant_name: entry.order_items?.variant_name || null,
    quantity: Number(entry.quantity) || 1,
    order_number: entry.order_items?.orders?.order_number || null,
  }));

  // Freight already paid inside the product price (CIF Tema, DDP). Record the
  // arrival rate for the timeline but never raise a zero cedi bill.
  if (pkg.freight_included) {
    await supabaseAdmin
      .from('shipping_packages')
      .update({
        final_usd_to_ghs: finalUsdToGhs,
        final_shipping_ghs: 0,
        shipping_payment_status: 'paid',
        shipping_paid_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', pkg.id);
    return null;
  }

  const amount = Number((Number(pkg.estimated_shipping_usd) * finalUsdToGhs).toFixed(2));

  const { data: latestInvoice } = await supabaseAdmin
    .from('financial_documents')
    .select('id, version, amount, status, data, due_at')
    .eq('flow', 'shipping')
    .eq('entity_id', pkg.id)
    .eq('document_type', 'invoice')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const prior = latestInvoice?.status !== 'void' ? latestInvoice : null;

  const syncLockedPackage = async () => {
    await supabaseAdmin
      .from('shipping_packages')
      .update({
        final_usd_to_ghs: finalUsdToGhs,
        final_shipping_ghs: amount,
        shipping_payment_status: 'unpaid',
        shipping_paid_at: null,
        updated_at: now.toISOString(),
      })
      .eq('id', pkg.id);
  };

  if (
    prior?.status === 'active' &&
    Number(prior.amount) === amount &&
    Number(prior.data?.usd_to_ghs) === finalUsdToGhs &&
    (!prior.due_at || new Date(prior.due_at).getTime() > Date.now())
  ) {
    await syncLockedPackage();
    return prior;
  }

  if (prior) {
    await supabaseAdmin
      .from('financial_documents')
      .update({ status: 'void', updated_at: now.toISOString() })
      .eq('id', prior.id);
  }
  const version = Number(latestInvoice?.version || 0) + 1;
  const dueAt = new Date(now.getTime() + validDays * 86_400_000).toISOString();
  const { data: invoice, error } = await supabaseAdmin
    .from('financial_documents')
    .insert({
      document_number: reference('INV-SHP'),
      document_type: 'invoice',
      flow: 'shipping',
      entity_id: pkg.id,
      order_id: primaryOrder.id,
      shipping_package_id: pkg.id,
      customer_user_id: customerUserId,
      customer_email: customerEmail,
      currency: 'GHS',
      amount,
      status: 'active',
      version,
      due_at: dueAt,
      data: {
        reference: orderNumbers.join(', '),
        order_numbers: orderNumbers,
        customer_name:
          [primaryOrder.shipping_address?.firstName, primaryOrder.shipping_address?.lastName]
            .filter(Boolean)
            .join(' ') || customerEmail,
        tracking_id: pkg.tracking_id,
        package_name: pkg.package_name,
        cbm: Number(pkg.cbm),
        usd_per_cbm: Number(pkg.usd_per_cbm),
        shipping_usd: Number(pkg.estimated_shipping_usd),
        usd_to_ghs: finalUsdToGhs,
        freight_included: Boolean(pkg.freight_included),
        contents,
      },
      created_by: createdBy || null,
    })
    .select()
    .single();
  if (error || !invoice) throw error || new Error('Could not create shipping invoice.');

  await syncLockedPackage();
  return invoice;
}

export async function createShippingReceipt(
  pkg: any,
  createdBy?: string | null,
  delayMinutes = 2,
) {
  const current = await existingReceipt('shipping', pkg.id);
  if (current) return current;
  const version = await nextDocumentVersion('shipping', pkg.id, 'receipt');
  const issuedAt = new Date().toISOString();
  const { data: invoice } = await supabaseAdmin
    .from('financial_documents')
    .select('*')
    .eq('flow', 'shipping')
    .eq('entity_id', pkg.id)
    .eq('document_type', 'invoice')
    .eq('status', 'active')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: packageItems } = await supabaseAdmin
    .from('shipping_package_items')
    .select('order_items(order_id, orders(id, order_number, email, user_id, shipping_address))')
    .eq('package_id', pkg.id);
  const orders = Array.from(
    new Map(
      (packageItems || [])
        .map((entry: any) => entry.order_items?.orders)
        .filter(Boolean)
        .map((order: any) => [order.id, order]),
    ).values(),
  ) as any[];
  const primaryOrder = orders[0];
  if (!primaryOrder) throw new Error('A shipping package must contain at least one order item.');
  const orderNumbers = orders.map((order) => order.order_number).filter(Boolean);
  const customerEmail = pkg.customer_email || primaryOrder.email || null;

  const { data: receipt, error } = await supabaseAdmin
    .from('financial_documents')
    .insert({
      document_number: reference('RCT-SHP'),
      document_type: 'receipt',
      flow: 'shipping',
      entity_id: pkg.id,
      order_id: primaryOrder.id,
      shipping_package_id: pkg.id,
      customer_user_id: pkg.customer_user_id || primaryOrder.user_id || null,
      customer_email: customerEmail,
      currency: 'GHS',
      amount: Number(pkg.final_shipping_ghs) || 0,
      status: 'paid',
      version,
      issued_at: issuedAt,
      paid_at: issuedAt,
      data: {
        ...(invoice?.data || {}),
        reference: invoice?.data?.reference || orderNumbers.join(', '),
        order_numbers: invoice?.data?.order_numbers || orderNumbers,
        customer_name:
          invoice?.data?.customer_name ||
          [primaryOrder.shipping_address?.firstName, primaryOrder.shipping_address?.lastName]
            .filter(Boolean)
            .join(' ') ||
          customerEmail,
        invoice_number: invoice?.document_number || null,
      },
      created_by: createdBy || null,
    })
    .select()
    .single();
  if (error || !receipt) throw error || new Error('Could not create shipping receipt.');
  if (invoice) {
    await supabaseAdmin
      .from('financial_documents')
      .update({ status: 'paid', paid_at: issuedAt })
      .eq('id', invoice.id);
  }
  await queueReceiptEmail({ flow: 'shipping', entityId: pkg.id, receipt, delayMinutes });
  return receipt;
}
