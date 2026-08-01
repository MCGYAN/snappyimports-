import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * POST /api/orders/claim
 * Attach guest orders (same email, no user_id) to the signed-in account.
 * Body optional: { orderNumber } to prefer linking a specific order first.
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

    // Only claim guest rows that match this account email.
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

    if (toClaim.length === 0) {
      return NextResponse.json({ success: true, claimed: 0, orderNumbers: [] });
    }

    const claimedAt = new Date().toISOString();
    const ids = toClaim.map((o) => o.id);

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

    return NextResponse.json({
      success: true,
      claimed: ids.length,
      orderNumbers: toClaim.map((o) => o.order_number),
    });
  } catch (e) {
    console.error('[orders/claim]', e);
    return NextResponse.json({ error: 'Failed to claim orders.' }, { status: 500 });
  }
}
