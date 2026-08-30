import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { verifyAuth } from '@/lib/auth';

/** Bust storefront caches after admin catalog changes. */
export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'products' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  revalidateTag('storefront-featured');
  revalidateTag('storefront-categories');
  revalidateTag('storefront-shop-default');
  revalidatePath('/');
  revalidatePath('/shop');
  revalidatePath('/categories');

  return NextResponse.json({ success: true, revalidated: true });
}
