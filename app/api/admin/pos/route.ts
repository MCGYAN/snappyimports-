import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';

/** POST /api/admin/pos — create POS order (service role bypasses RLS) */
export async function POST(req: Request) {
  try {
    const authResult = await verifyAuth(req, { requireAdmin: true });
    if (!authResult.authenticated) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      orderNumber,
      customerEmail,
      customerPhone,
      customerName,
      status,
      paymentStatus,
      paymentMethod,
      deliveryMethod,
      subtotal,
      tax,
      total,
      addressData,
      cart,
      isCashOrCard
    } = body;

    if (!orderNumber || !cart || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: 'Missing order data' }, { status: 400 });
    }

    if (!customerEmail || typeof customerEmail !== 'string') {
      return NextResponse.json({ error: 'Customer email is required' }, { status: 400 });
    }

    const orderPayload = {
      order_number: orderNumber,
      user_id: null,
      email: customerEmail,
      phone: customerPhone || null,
      status: status || 'pending',
      payment_status: paymentStatus || 'pending',
      currency: 'USD',
      subtotal: Number(subtotal) || 0,
      tax_total: Number(tax) || 0,
      shipping_total: 0,
      discount_total: 0,
      total: Number(total) || 0,
      shipping_method: deliveryMethod || 'pickup',
      payment_method: paymentMethod || 'cash',
      shipping_address: addressData || {},
      billing_address: addressData || {},
      metadata: {
        pos_sale: true,
        first_name: addressData?.firstName || '',
        last_name: addressData?.lastName || '',
        phone: customerPhone || ''
      }
    };

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();

    if (orderError) {
      console.error('[POS API] Order insert error:', orderError);
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
    }

    const orderItems = cart.map((item: { id: string; name: string; cartQuantity: number; price: number; image?: string }) => ({
      order_id: order.id,
      product_id: item.id,
      product_name: item.name,
      quantity: item.cartQuantity,
      unit_price: item.price,
      total_price: item.price * item.cartQuantity,
      metadata: { image: item.image, pos_sale: true }
    }));

    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItems);
    if (itemsError) {
      console.error('[POS API] Order items insert error:', itemsError);
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Failed to create order items' }, { status: 500 });
    }

    const hasRealEmail = customerEmail && customerEmail !== 'pos-walkin@store.local';
    const upsertEmail = hasRealEmail
      ? customerEmail
      : customerPhone
        ? `${customerPhone.replace(/[^0-9]/g, '')}@pos.local`
        : null;

    if (upsertEmail) {
      try {
        await supabaseAdmin.rpc('upsert_customer_from_order', {
          p_email: upsertEmail,
          p_phone: customerPhone || null,
          p_full_name: customerName || null,
          p_first_name: addressData?.firstName || null,
          p_last_name: addressData?.lastName || null,
          p_user_id: null,
          p_address: addressData || null
        });
      } catch (custErr) {
        console.error('[POS API] Customer upsert error (non-fatal):', custErr);
      }
    }

    if (isCashOrCard) {
      try {
        await supabaseAdmin.rpc('mark_order_paid', {
          order_ref: orderNumber,
          moolre_ref: `POS-${(paymentMethod || 'cash').toUpperCase()}-${Date.now()}`
        });
      } catch (stockErr) {
        console.error('[POS API] Stock reduction error (non-fatal):', stockErr);
      }
    }

    return NextResponse.json({ success: true, order });
  } catch (e) {
    console.error('[POS API] Error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
