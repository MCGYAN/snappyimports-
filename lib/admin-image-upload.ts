'use client';

import { supabase } from '@/lib/supabase';

export async function uploadAdminImage(
  file: File,
  purpose: 'product' | 'category',
): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in required.');

  const body = new FormData();
  body.set('file', file);
  body.set('purpose', purpose);

  const response = await fetch('/api/admin/images', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.url) {
    throw new Error(result.error || 'Could not upload the image.');
  }
  return result.url as string;
}
