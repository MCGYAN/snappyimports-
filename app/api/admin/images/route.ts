import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import {
  randomImagePath,
  sanitizeImageFile,
  SecureImageError,
} from '@/lib/secure-image';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

const BUCKET = 'products';

export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'products' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const rate = checkRateLimit(
    `admin-image:${auth.user?.id || getClientIdentifier(req)}`,
    RATE_LIMITS.default,
  );
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many uploads. Try again shortly.' }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid upload.' }, { status: 400 });
  }

  const purpose = String(form.get('purpose') || '').trim();
  const file = form.get('file');
  if (purpose !== 'product' && purpose !== 'category') {
    return NextResponse.json({ error: 'Choose product or category.' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose an image to upload.' }, { status: 400 });
  }

  try {
    const safe = await sanitizeImageFile(file, 'product');
    const path = randomImagePath(purpose === 'category' ? 'categories' : 'products', safe.extension);
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, safe.buffer, {
      contentType: safe.contentType,
      upsert: false,
    });
    if (error) {
      console.error('[admin images]', error);
      return NextResponse.json({ error: 'Could not save the image.' }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ success: true, url: publicUrl, path });
  } catch (error) {
    if (error instanceof SecureImageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[admin images]', error);
    return NextResponse.json({ error: 'Could not process that image.' }, { status: 500 });
  }
}
