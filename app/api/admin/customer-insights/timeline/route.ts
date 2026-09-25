import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'customers' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const key = String(new URL(req.url).searchParams.get('key') || '').trim().slice(0, 320);
  if (!key) return NextResponse.json({ error: 'Missing customer.' }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc('customer_insight_timeline', { p_customer_key: key });
  if (error) {
    console.error('[customer insight timeline]', error);
    return NextResponse.json({ error: error.message || 'Could not load timeline.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, events: data || [] });
}
