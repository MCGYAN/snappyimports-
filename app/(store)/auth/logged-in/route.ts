import { NextResponse } from 'next/server';

/**
 * After a successful client-side sign-in, the login page POSTs here with
 * username/password fields so Safari/Chrome can offer "Save Password".
 * The body is discarded. We only redirect to the next app page.
 */
function safeNextPath(value: unknown): string {
  const next = typeof value === 'string' ? value.trim() : '';
  if (next.startsWith('/') && !next.startsWith('//')) return next;
  return '/account';
}

export async function POST(req: Request) {
  let next = '/account';
  try {
    const form = await req.formData();
    next = safeNextPath(form.get('next'));
  } catch {
    /* ignore */
  }
  return NextResponse.redirect(new URL(next, req.url), 303);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = safeNextPath(url.searchParams.get('next'));
  return NextResponse.redirect(new URL(next, req.url), 303);
}
