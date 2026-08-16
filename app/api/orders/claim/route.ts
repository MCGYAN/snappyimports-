import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/orders/claim
 * Attach guest shop orders and RMB exchanges (same email, no user_id)
 * to the signed-in account.
 * Body optional: { orderNumber } for shop claim metadata.
 */
export async function POST(req: Request) {
  try {
    const clientId = getClientIdentifier(req);
    const rate = checkRateLimit(`order-claim:${clientId}`, RATE_LIMITS.payment);
    if (!rate.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user?.id || !user.email) {
      return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
    }

    const email = user.email.trim().toLowerCase();
    let orderNumber: string | undefined;
    try {
      const body = await req.json();
      orderNumber = typeof body?.orderNumber === 'string' ? body.orderNumber.trim() : undefined;
    } catch {
      orderNumber = undefined;
    }

    const claimedAt = new Date().toISOString();

    // Shop guest orders with matching email
    const { data: guests, error: findError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, email, user_id, metadata')
      .is('user_id', null)
      .ilike('email', email);

    if (findError) {
      console.error('[orders/claim] find', findError);
      return NextResponse.json({ error: 'Could not claim orders.' }, { status: 500 });
    }

    const toClaim = (guests || []).filter(
      (o) => (o.email || '').trim().toLowerCase() === email,
    );

    if (toClaim.length > 0) {
      const updates = await Promise.all(
        toClaim.map((o) => {
          const meta = {
            ...(o.metadata && typeof o.metadata === 'object' ? o.metadata : {}),
            guest_checkout: false,
            claimed_at: claimedAt,
            claimed_from: orderNumber || o.order_number,
          };
          return supabaseAdmin
            .from('orders')
            .update({ user_id: user.id, metadata: meta })
            .eq('id', o.id)
            .is('user_id', null);
        }),
      );

      const failed = updates.find((u) => u.error);
      if (failed?.error) {
        console.error('[orders/claim] update', failed.error);
        return NextResponse.json({ error: 'Could not link orders to your account.' }, { status: 500 });
      }
    }

    // Guest RMB exchanges with matching email
    const { data: guestExchanges, error: exFindError } = await supabaseAdmin
      .from('exchange_orders')
      .select('id, exchange_number, email, user_id, metadata')
      .is('user_id', null)
      .ilike('email', email);

    if (exFindError) {
      console.error('[orders/claim] exchange find', exFindError);
      return NextResponse.json({ error: 'Could not claim RMB orders.' }, { status: 500 });
    }

    const exchangesToClaim = (guestExchanges || []).filter(
      (o) => (o.email || '').trim().toLowerCase() === email,
    );

    if (exchangesToClaim.length > 0) {
      const exUpdates = await Promise.all(
        exchangesToClaim.map((o) => {
          const meta = {
            ...(o.metadata && typeof o.metadata === 'object' ? o.metadata : {}),
            claimed_at: claimedAt,
          };
          return supabaseAdmin
            .from('exchange_orders')
            .update({ user_id: user.id, metadata: meta })
            .eq('id', o.id)
            .is('user_id', null);
        }),
      );

      const exFailed = exUpdates.find((u) => u.error);
      if (exFailed?.error) {
        console.error('[orders/claim] exchange update', exFailed.error);
        return NextResponse.json({ error: 'Could not link RMB orders to your account.' }, { status: 500 });
      }
    }

    await supabaseAdmin
      .from('financial_documents')
      .update({ customer_user_id: user.id, updated_at: claimedAt })
      .is('customer_user_id', null)
      .ilike('customer_email', email);

    // Attach packages owned by this email, and packages linked through claimed orders.
    await supabaseAdmin
      .from('shipping_packages')
      .update({ customer_user_id: user.id, updated_at: claimedAt })
      .is('customer_user_id', null)
      .ilike('customer_email', email);

    if (toClaim.length > 0) {
      const claimedOrderIds = toClaim.map((order) => order.id);
      const { data: claimedItems } = await supabaseAdmin
        .from('order_items')
        .select('id')
        .in('order_id', claimedOrderIds);
      const claimedItemIds = (claimedItems || []).map((item) => item.id);
      if (claimedItemIds.length) {
        const { data: packageLinks } = await supabaseAdmin
          .from('shipping_package_items')
          .select('package_id')
          .in('order_item_id', claimedItemIds);
        const packageIds = [...new Set((packageLinks || []).map((link) => link.package_id))];
        if (packageIds.length) {
          await supabaseAdmin
            .from('shipping_packages')
            .update({ customer_user_id: user.id, updated_at: claimedAt })
            .in('id', packageIds)
            .is('customer_user_id', null);
        }
      }
    }

    return NextResponse.json({
      success: true,
      claimed: toClaim.length + exchangesToClaim.length,
      orderNumbers: toClaim.map((o) => o.order_number),
      exchangeNumbers: exchangesToClaim.map((o) => o.exchange_number),
    });
  } catch (e) {
    console.error('[orders/claim]', e);
    return NextResponse.json({ error: 'Failed to claim orders.' }, { status: 500 });
  }
}
