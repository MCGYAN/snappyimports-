import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyAuth } from '@/lib/auth';

/** POST — customer: I've paid | admin: confirm / complete */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = String(body.action || '').trim();
    const exchangeNumber = String(body.exchangeNumber || '').trim();

    if (!exchangeNumber || !action) {
      return NextResponse.json({ error: 'exchangeNumber and action required.' }, { status: 400 });
    }

    const { data: exchange, error } = await supabaseAdmin
      .from('exchange_orders')
      .select('*')
      .eq('exchange_number', exchangeNumber)
      .single();

    if (error || !exchange) {
      return NextResponse.json({ error: 'Exchange not found.' }, { status: 404 });
    }

    if (action === 'payment_sent') {
      const clientId = getClientIdentifier(req);
      const rate = checkRateLimit(`ex-paid:${clientId}`, RATE_LIMITS.payment);
      if (!rate.success) {
        return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
      }

      const phone = String(body.phone || '').trim();
      const digits = (s: string) => s.replace(/\D/g, '');
      if (!phone || !digits(exchange.phone).endsWith(digits(phone).slice(-9))) {
        return NextResponse.json({ error: 'Phone does not match.' }, { status: 403 });
      }

      if (exchange.due_at && new Date(exchange.due_at).getTime() < Date.now()) {
        await supabaseAdmin
          .from('exchange_orders')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', exchange.id);
        return NextResponse.json({ error: 'This exchange rate lock expired.' }, { status: 400 });
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('exchange_orders')
        .update({
          status: 'payment_sent',
          payment_status: 'awaiting_confirmation',
          payment_sent_at: new Date().toISOString(),
          payment_note: String(body.note || '').slice(0, 500) || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', exchange.id)
        .select()
        .single();

      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      return NextResponse.json({ success: true, exchange: updated });
    }

    const auth = await verifyAuth(req, { requireAdmin: true });
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (action === 'confirm') {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('exchange_orders')
        .update({
          status: 'confirmed',
          payment_status: 'paid',
          confirmed_at: new Date().toISOString(),
          admin_notes: String(body.note || '').slice(0, 500) || exchange.admin_notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', exchange.id)
        .select()
        .single();
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      return NextResponse.json({ success: true, exchange: updated });
    }

    if (action === 'complete') {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('exchange_orders')
        .update({
          status: 'completed',
          payment_status: 'paid',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', exchange.id)
        .select()
        .single();
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      return NextResponse.json({ success: true, exchange: updated });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    console.error('[exchange action]', e);
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  }
}
