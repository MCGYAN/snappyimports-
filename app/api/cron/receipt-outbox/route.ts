import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import { sendReceiptReadyEmail } from '@/lib/notifications';

async function processOutbox() {
  const { data: rows, error } = await supabaseAdmin
    .from('notification_outbox')
    .select('*')
    .eq('status', 'pending')
    .lte('send_after', new Date().toISOString())
    .order('send_after', { ascending: true })
    .limit(40);
  if (error) throw error;

  let sent = 0;
  let failed = 0;
  for (const row of rows || []) {
    const { data: claimed } = await supabaseAdmin
      .from('notification_outbox')
      .update({ status: 'sending', attempts: Number(row.attempts || 0) + 1 })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;
    try {
      await sendReceiptReadyEmail({
        to: row.recipient,
        documentNumber: row.payload?.document_number || '',
        amount: Number(row.payload?.amount) || 0,
        currency: row.payload?.currency || 'GHS',
        label: row.payload?.label || 'payment',
        documentId: row.payload?.document_id || '',
      });
      await supabaseAdmin
        .from('notification_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', row.id);
      sent++;
    } catch (sendError) {
      const attempts = Number(row.attempts || 0) + 1;
      const message = sendError instanceof Error ? sendError.message : 'Send failed';
      const quotaLimited = /quota|rate limit|too many/i.test(message);
      await supabaseAdmin
        .from('notification_outbox')
        .update({
          status: !quotaLimited && attempts >= 3 ? 'failed' : 'pending',
          attempts: quotaLimited ? Number(row.attempts || 0) : attempts,
          send_after: new Date(
            Date.now() + (quotaLimited ? 6 * 60 : Math.min(30, attempts * 5)) * 60_000,
          ).toISOString(),
          last_error: message.slice(0, 500),
        })
        .eq('id', row.id);
      failed++;
    }
  }
  return { processed: (rows || []).length, sent, failed };
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, ...(await processOutbox()) });
  } catch (error) {
    console.error('[receipt outbox]', error);
    return NextResponse.json({ error: 'Could not process receipt emails.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ success: true, ...(await processOutbox()) });
  } catch (error) {
    console.error('[receipt outbox]', error);
    return NextResponse.json({ error: 'Could not process receipt emails.' }, { status: 500 });
  }
}
