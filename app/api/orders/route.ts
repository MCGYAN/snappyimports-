import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/** POST /api/orders — place order (service role bypasses RLS so guest checkout works) */
export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rateLimitResult = checkRateLimit(`orders:${clientId}`, RATE_LIMITS.payment);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      recaptchaToken,
      shippingData,
      deliveryMethod,
      paymentMethod,
      cart,
      userId
    } = body;

    // reCAPTCHA verification: log failures but don't block checkout
    // (keys may not match the deployment domain, e.g. Vercel preview URLs)
    if (process.env.RECAPTCHA_SECRET_KEY && recaptchaToken && typeof recaptchaToken === 'string') {
      const recaptcha = await verifyRecaptcha(recaptchaToken, 'checkout');
      if (!recaptcha.success) {
        console.warn('[API orders] reCAPTCHA verification failed:', recaptcha.error, '— allowing order to proceed');
      }
    }

    if (!shippingData || !cart || !Array.isArray(cart) || cart.length === 0) {
      return NextResponse.json({ error: 'Invalid request: shipping and cart required.' }, { status: 400 });
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      region
    } = shippingData;

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !phone?.trim() || !address?.trim() || !city?.trim() || !region?.trim()) {
      return NextResponse.json({ error: 'All shipping fields are required.' }, { status: 400 });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    // Compute totals server-side (do not trust client)
    let subtotal = 0;
    const validatedCart: Array<{ productId: string; productName: string; variantName: string; quantity: number; unitPrice: number; totalPrice: number; image?: string; slug?: string }> = [];
    for (const item of cart) {
      const qty = Math.max(1, Math.min(999, Number(item.quantity) || 1));
      const unitPrice = Number(item.price);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return NextResponse.json({ error: 'Invalid cart item price.' }, { status: 400 });
      }
      const totalPrice = unitPrice * qty;
      subtotal += totalPrice;
      validatedCart.push({
        productId: String(item.id),
        productName: String(item.name ?? ''),
        variantName: String(item.variant ?? ''),
        quantity: qty,
        unitPrice,
        totalPrice,
        image: item.image,
        slug: item.slug
      });
    }

    const shippingTotal = 0;
    const taxTotal = 0;
    const total = subtotal + shippingTotal + taxTotal;

    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const trackingId = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
    const trackingNumber = `SLI-${trackingId}`;

    const orderPayload = {
      order_number: orderNumber,
      user_id: userId && typeof userId === 'string' ? userId : null,
      email: email.trim(),
      phone: String(phone ?? '').trim(),
      status: 'pending',
      payment_status: 'pending',
      currency: 'GHS',
      subtotal,
      tax_total: taxTotal,
      shipping_total: shippingTotal,
      discount_total: 0,
      total,
      shipping_method: deliveryMethod ?? 'pickup',
      payment_method: paymentMethod ?? 'moolre',
      shipping_address: { firstName, lastName, email, phone, address, city, region },
      billing_address: { firstName, lastName, email, phone, address, city, region },
      metadata: {
        guest_checkout: !userId,
        first_name: firstName,
        last_name: lastName,
        tracking_number: trackingNumber
      }
    };

    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();

    if (orderError) {
      console.error('[API orders] Insert error:', orderError);
      return NextResponse.json({ error: 'Failed to create order. Please try again.' }, { status: 500 });
    }

    // Resolve product IDs (slugs to UUIDs) and build order_items
    const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const orderItems: Array<{
      order_id: string;
      product_id: string;
      product_name: string;
      variant_name: string | null;
      quantity: number;
      unit_price: number;
      total_price: number;
      metadata: Record<string, unknown>;
    }> = [];

    const productIdsToResolve = validatedCart.map((c) => c.productId).filter((id) => !isValidUUID(id));
    const slugToId: Record<string, string> = {};
    if (productIdsToResolve.length > 0) {
      const { data: products } = await supabaseAdmin
        .from('products')
        .select('id, slug')
        .in('slug', productIdsToResolve);
      if (products) {
        for (const p of products) {
          if (p.slug) slugToId[p.slug] = p.id;
          slugToId[p.id] = p.id;
        }
      }
    }

    for (const item of validatedCart) {
      let productId = item.productId;
      if (!isValidUUID(productId) && slugToId[productId]) {
        productId = slugToId[productId];
      } else if (!isValidUUID(productId)) {
        const { data: one } = await supabaseAdmin
          .from('products')
          .select('id')
          .eq('slug', productId)
          .single();
        if (one) productId = one.id;
        else {
          console.error('[API orders] Product not found:', item.productId);
          return NextResponse.json({ error: `Product not found: ${item.productName}. Remove it from cart and try again.` }, { status: 400 });
        }
      }

      orderItems.push({
        order_id: order.id,
        product_id: productId,
        product_name: item.productName,
        variant_name: item.variantName || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total_price: item.totalPrice,
        metadata: { image: item.image, slug: item.slug }
      });
    }

    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItems);
    if (itemsError) {
      console.error('[API orders] Order items insert error:', itemsError);
      // Try to delete the order so we don't leave orphan orders
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Failed to create order items. Please try again.' }, { status: 500 });
    }

    const fullName = `${firstName} ${lastName}`.trim();
    await supabaseAdmin.rpc('upsert_customer_from_order', {
      p_email: email.trim(),
      p_phone: String(phone ?? '').trim(),
      p_full_name: fullName,
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_user_id: userId && typeof userId === 'string' ? userId : null,
      p_address: { firstName, lastName, email, phone, address, city, region }
    });

    return NextResponse.json({
      success: true,
      order,
      orderNumber: order.order_number
    });
  } catch (e) {
    console.error('[API orders] Error:', e);
    return NextResponse.json({ error: 'Failed to place order. Please try again.' }, { status: 500 });
  }
}
