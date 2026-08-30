import { supabase } from '@/lib/supabase';

/** Ask the server to refresh cached homepage, shop, and category pages. */
export async function revalidateStorefrontFromAdmin(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  await fetch('/api/admin/revalidate-storefront', {
    method: 'POST',
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
  });
}
