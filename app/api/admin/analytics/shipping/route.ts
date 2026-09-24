import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { hasAdminModule } from '@/lib/admin-permissions';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const MAX_MONTHS = 10;
const DAY_MS = 86_400_000;
const MAX_RANGE_MS = MAX_MONTHS * 31 * DAY_MS;

function parseDayStart(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDayEnd(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function canAccessShippingAnalytics(role: string | null | undefined, permissions: unknown) {
  return (
    hasAdminModule(role, permissions, 'orders') ||
    hasAdminModule(role, permissions, 'warehouse')
  );
}

export async function GET(req: Request) {
  const auth = await verifyAuth(req, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  if (!canAccessShippingAnalytics(auth.role, auth.permissions)) {
    return NextResponse.json({ error: 'You do not have access to this feature' }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = parseDayStart(url.searchParams.get('from'));
  const to = parseDayEnd(url.searchParams.get('to'));
  if (!from || !to) {
    return NextResponse.json(
      { error: 'Choose a start date and end date (YYYY-MM-DD).' },
      { status: 400 },
    );
  }
  if (to.getTime() < from.getTime()) {
    return NextResponse.json(
      { error: 'End date must be on or after the start date.' },
      { status: 400 },
    );
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
    return NextResponse.json(
      { error: `Date range cannot exceed ${MAX_MONTHS} months.` },
      { status: 400 },
    );
  }

  const search = String(url.searchParams.get('q') || '').trim();
  const status = String(url.searchParams.get('status') || 'all').trim().toLowerCase();
  const exportMode = url.searchParams.get('export') === '1';
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize')) || 50));

  const { data, error } = await supabaseAdmin.rpc('shipping_packages_analytics', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_search: search || null,
    p_status: status === 'all' ? null : status,
    p_page: page,
    p_page_size: pageSize,
    p_export: exportMode,
  });

  if (error) {
    console.error('[shipping analytics]', error);
    return NextResponse.json(
      { error: error.message || 'Could not load shipping analytics.' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    ...(data && typeof data === 'object' ? data : { packages: [], total: 0, summary: {} }),
  });
}
