import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { runAnalyticsRpc } from '@/lib/server-analytics';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await verifyAuth(req, { requireOwner: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  return runAnalyticsRpc(req, 'shop_orders_analytics', 'stage');
}
