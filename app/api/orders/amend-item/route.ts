import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import { formatVariantLabel, getVariantColor, getVariantSizeLabel } from '@/lib/product-variants';

const LOCKED_STATUS = new Set(['shipped', 'delivered', 'cancelled']);

/** POST — amend an order line item variant (color/option) with price check + history */
export async function POST(req: Request) {
  try {
    const auth = await verifyAuth(req, { requireAdmin: true });
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const orderId = String(body.orderId || '').trim();
    const orderItemId = String(body.orderItemId || '').trim();
    const newVariantId = String(body.variantId || '').trim();
    const reason = String(body.reason || '').trim().slice(0, 500);

    if (!orderId || !orderItemId || !newVariantId) {
      return NextResponse.json({ error: 'orderId, orderItemId, and variantId are required.' }, { status: 400 });
    }
    if (reason.length < 5) {
      return NextResponse.json({ error: 'Add a short reason for the change.' }, { status: 400 });
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    if (LOCKED_STATUS.has(order.status)) {
      return NextResponse.json(
        { error: `Cannot amend items while order is ${order.status}.` },
        { status: 400 },
      );
    }

    const item = (order.order_items || []).find((i: any) => i.id === orderItemId);
    if (!item) {
      return NextResponse.json({ error: 'Order item not found.' }, { status: 404 });
    }

    const { data: variant, error: variantError } = await supabaseAdmin
      .from('product_variants')
      .select('id, product_id, name, option1, option2, option3, price, quantity, sku')
      .eq('id', newVariantId)
      .single();

    if (variantError || !variant) {
      return NextResponse.json({ error: 'Variant not found.' }, { status: 404 });
    }

    if (item.product_id && variant.product_id !== item.product_id) {
      return NextResponse.json({ error: 'Variant does not belong to this product.' }, { status: 400 });
    }

    const qty = Math.max(1, Number(item.quantity) || 1);
    const oldUnit = Number(item.unit_price) || 0;
    const newUnit = Number(variant.price);
    if (!Number.isFinite(newUnit) || newUnit < 0) {
      return NextResponse.json({ error: 'Variant has an invalid price.' }, { status: 400 });
    }

    const oldTotal = Number(item.total_price) || oldUnit * qty;
    const newTotal = newUnit * qty;
    const lineDelta = newTotal - oldTotal;
    const variantLabel = formatVariantLabel(variant) || variant.name || 'Option';
    const color = getVariantColor(variant);
    const size = getVariantSizeLabel(variant);

    const amendment = {
      at: new Date().toISOString(),
      by: auth.user?.id || null,
      reason,
      order_item_id: orderItemId,
      product_name: item.product_name,
      from: {
        variant_id: item.variant_id || item.metadata?.variant_id || null,
        variant_name: item.variant_name,
        unit_price: oldUnit,
        total_price: oldTotal,
        color: item.metadata?.color || null,
        size: item.metadata?.size || null,
      },
      to: {
        variant_id: variant.id,
        variant_name: variantLabel,
        unit_price: newUnit,
        total_price: newTotal,
        color: color || null,
        size: size || null,
      },
      line_delta: lineDelta,
    };

    const { error: itemUpdateError } = await supabaseAdmin
      .from('order_items')
      .update({
        variant_id: variant.id,
        variant_name: variantLabel,
        unit_price: newUnit,
        total_price: newTotal,
        sku: variant.sku || item.sku || null,
        metadata: {
          ...(item.metadata || {}),
          color: color || null,
          size: size || null,
          variant_id: variant.id,
          amended_at: amendment.at,
          previous_variant_name: item.variant_name,
        },
      })
      .eq('id', orderItemId);

    if (itemUpdateError) {
      console.error('[amend-item] item', itemUpdateError);
      return NextResponse.json({ error: 'Failed to update line item.' }, { status: 500 });
    }

    const { data: freshItems } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    const subtotal = (freshItems || []).reduce(
      (sum: number, row: any) => sum + (Number(row.total_price) || 0),
      0,
    );
    const shipping = Number(order.shipping_total) || 0;
    const tax = Number(order.tax_total) || 0;
    const discount = Number(order.discount_total) || 0;
    const total = Math.max(0, subtotal + shipping + tax - discount);
    const paidSoFar =
      Number(order.metadata?.amount_paid) ||
      (order.payment_status === 'paid' ? Number(order.total) || 0 : 0);

    // If already paid, track balance/credit. If unpaid, just refresh totals.
    let paymentStatus = order.payment_status;
    let balanceDue = 0;
    let creditDue = 0;

    if (order.payment_status === 'paid') {
      balanceDue = Math.max(0, total - paidSoFar);
      creditDue = Math.max(0, paidSoFar - total);
      if (balanceDue > 0.009) {
        paymentStatus = 'awaiting_confirmation';
      }
    }

    const metadata = {
      ...(order.metadata || {}),
      amendments: [...(order.metadata?.amendments || []), amendment],
      last_amended_at: amendment.at,
      balance_due: balanceDue > 0.009 ? Number(balanceDue.toFixed(2)) : 0,
      credit_due: creditDue > 0.009 ? Number(creditDue.toFixed(2)) : 0,
      amount_paid:
        order.payment_status === 'paid' || Number(order.metadata?.amount_paid) > 0
          ? paidSoFar || Number(order.total) || 0
          : order.metadata?.amount_paid || null,
    };

    const { data: updated, error: orderUpdateError } = await supabaseAdmin
      .from('orders')
      .update({
        subtotal,
        total,
        payment_status: paymentStatus,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select('*, order_items(*)')
      .single();

    if (orderUpdateError) {
      console.error('[amend-item] order', orderUpdateError);
      return NextResponse.json({ error: 'Item updated but order totals failed.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      order: updated,
      amendment,
      priceChange: {
        lineDelta: Number(lineDelta.toFixed(2)),
        balanceDue: metadata.balance_due,
        creditDue: metadata.credit_due,
        samePrice: Math.abs(lineDelta) < 0.009,
      },
    });
  } catch (e) {
    console.error('[amend-item]', e);
    return NextResponse.json({ error: 'Failed to amend item.' }, { status: 500 });
  }
}
