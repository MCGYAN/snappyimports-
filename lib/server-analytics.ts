import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseAnalyticsRange } from '@/lib/analytics-range';

type AnalyticsRpc = 'shop_orders_analytics' | 'rmb_orders_analytics' | 'shipping_packages_analytics';

export async function runAnalyticsRpc(req: Request, rpc: AnalyticsRpc, filterParam: 'stage' | 'status') {
  const url = new URL(req.url);
  const range = parseAnalyticsRange(url.searchParams);
  if ('error' in range) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }

  const search = String(url.searchParams.get('q') || '').trim().slice(0, 120);
  const filter = String(url.searchParams.get(filterParam) || 'all').trim().toLowerCase();
  const exportMode = url.searchParams.get('export') === '1';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 50));

  const { data, error } = await supabaseAdmin.rpc(rpc, {
    p_from: range.from,
    p_to: range.to,
    p_search: search || null,
    [filterParam === 'stage' ? 'p_stage' : 'p_status']: filter === 'all' ? null : filter,
    p_page: page,
    p_page_size: pageSize,
    p_export: exportMode,
  });

  if (error) {
    console.error(`[analytics ${rpc}]`, error);
    return NextResponse.json({ error: error.message || 'Could not load analytics.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...((data as object) || {}) });
}
