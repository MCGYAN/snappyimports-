import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { hasAdminModule } from '@/lib/admin-permissions';
import { runAnalyticsRpc } from '@/lib/server-analytics';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await verifyAuth(req, { requireAdmin: true });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  if (
    !hasAdminModule(auth.role, auth.permissions, 'orders') &&
    !hasAdminModule(auth.role, auth.permissions, 'warehouse')
  ) {
    return NextResponse.json({ error: 'You do not have access to this feature' }, { status: 403 });
  }
  return runAnalyticsRpc(req, 'shipping_packages_analytics', 'status');
}
