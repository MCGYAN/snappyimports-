import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyAuth } from '@/lib/auth';
import {
  sendExchangePaymentAwaitingAdminAlert,
  sendExchangeBuyerStatusEmail,
} from '@/lib/notifications';
import { createAdminNotification } from '@/lib/admin-notifications';
import {
  formatLocalMoney,
  parseExchangeCountryCode,
} from '@/lib/exchange-corridors';
import { createRmbReceipt } from '@/lib/financial-documents';

function sanitizeExchange(row: any) {
  if (!row) return row;
  const { alipay_qr_path, ...rest } = row;
  return {
    ...rest,
    has_alipay_qr: Boolean(alipay_qr_path),
  };
}

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

      try {
        await sendExchangePaymentAwaitingAdminAlert(updated);
      } catch (notifyErr) {
        console.error('[exchange action] admin alert failed', notifyErr);
      }

      const country = parseExchangeCountryCode(
        updated.country_code || updated.metadata?.country_code,
      );
      await createAdminNotification({
        type: 'exchange_payment_sent',
        title: 'Buy RMB customer says payment was sent',
        message: `${updated.customer_name} says they paid ${formatLocalMoney(
          Number(updated.amount_from),
          country,
        )} for ${updated.exchange_number}. Confirm it before sending RMB.`,
        href: `/admin/exchange/${encodeURIComponent(updated.exchange_number)}`,
        entityId: updated.id,
        entityNumber: updated.exchange_number,
      });

      return NextResponse.json({ success: true, exchange: sanitizeExchange(updated) });
    }

    const auth = await verifyAuth(req, { requireModule: 'exchange' });
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
      try {
        await createRmbReceipt(updated, auth.user?.id, 2);
      } catch (receiptError) {
        console.error('[exchange action] receipt queue failed', receiptError);
      }
      const country = parseExchangeCountryCode(
        updated.country_code || updated.metadata?.country_code,
      );
      await createAdminNotification({
        type: 'exchange_paid',
        title: 'Buy RMB payment confirmed',
        message: `${formatLocalMoney(
          Number(updated.amount_from),
          country,
        )} was confirmed for ${updated.exchange_number}. Send ${Number(
          updated.amount_to,
        ).toFixed(2)} RMB to the saved Alipay QR.`,
        href: `/admin/exchange/${encodeURIComponent(updated.exchange_number)}`,
        entityId: updated.id,
        entityNumber: updated.exchange_number,
      });
      return NextResponse.json({
        success: true,
        exchange: sanitizeExchange(updated),
        undoUntil: new Date(Date.now() + 2 * 60_000).toISOString(),
      });
    }

    if (action === 'undo_confirm') {
      const confirmedAt = exchange.confirmed_at ? new Date(exchange.confirmed_at).getTime() : 0;
      if (
        exchange.payment_status !== 'paid' ||
        exchange.status !== 'confirmed' ||
        !confirmedAt ||
        Date.now() - confirmedAt > 2 * 60_000
      ) {
        return NextResponse.json({ error: 'The 2-minute undo window has closed.' }, { status: 400 });
      }
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('exchange_orders')
        .update({
          status: 'payment_sent',
          payment_status: 'awaiting_confirmation',
          confirmed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', exchange.id)
        .select()
        .single();
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      await Promise.all([
        supabaseAdmin
          .from('financial_documents')
          .update({ status: 'void', updated_at: new Date().toISOString() })
          .eq('flow', 'rmb')
          .eq('entity_id', exchange.id)
          .eq('document_type', 'receipt')
          .neq('status', 'void'),
        supabaseAdmin
          .from('notification_outbox')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('event_key', `rmb-receipt:${exchange.id}`)
          .eq('status', 'pending'),
      ]);
      return NextResponse.json({ success: true, exchange: sanitizeExchange(updated) });
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
      try {
        await sendExchangeBuyerStatusEmail(updated, 'completed');
      } catch (notifyErr) {
        console.error('[exchange action] buyer complete email failed', notifyErr);
      }
      return NextResponse.json({ success: true, exchange: sanitizeExchange(updated) });
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (e) {
    console.error('[exchange action]', e);
    return NextResponse.json({ error: 'Failed.' }, { status: 500 });
  }
}
