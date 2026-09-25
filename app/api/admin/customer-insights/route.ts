import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'customers' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const pick = (key: string, fallback = 'all') => String(url.searchParams.get(key) || fallback).trim().toLowerCase();

  const { data, error } = await supabaseAdmin.rpc('customer_insights', {
    p_search: String(url.searchParams.get('q') || '').trim().slice(0, 120) || null,
    p_segment: pick('segment'),
    p_service: pick('service'),
    p_sort: pick('sort', 'value'),
    p_page: Math.max(1, Number(url.searchParams.get('page')) || 1),
    p_page_size: Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 25)),
    p_export: url.searchParams.get('export') === '1',
  });

  if (error) {
    console.error('[customer insights]', error);
    return NextResponse.json({ error: error.message || 'Could not load customer insights.' }, { status: 500 });
  }
  return NextResponse.json({ success: true, ...((data as object) || {}) });
}
