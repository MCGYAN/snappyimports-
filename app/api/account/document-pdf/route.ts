import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { SITE_LOGO_LIGHT_BG_PATH } from '@/lib/brand';
import { generateFinancialDocumentPdf } from '@/lib/server-financial-document-pdf';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

let cachedLogo: ArrayBuffer | null | undefined;

async function loadInvoiceLogo(origin: string): Promise<ArrayBuffer | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const logoResponse = await fetch(new URL(SITE_LOGO_LIGHT_BG_PATH, origin), {
      cache: 'force-cache',
    });
    cachedLogo = logoResponse.ok ? await logoResponse.arrayBuffer() : null;
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

export async function GET(req: Request) {
  const auth = await verifyAuth(req);
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const url = new URL(req.url);
  const documentId = url.searchParams.get('id')?.trim();
  if (!documentId) {
    return NextResponse.json({ error: 'Document is required.' }, { status: 400 });
  }

  const email = auth.user.email?.trim().toLowerCase();
  const ownerFilter = email
    ? `customer_user_id.eq.${auth.user.id},customer_email.ilike.${email}`
    : `customer_user_id.eq.${auth.user.id}`;
  const { data: document, error } = await supabaseAdmin
    .from('financial_documents')
    .select(
      'id, document_number, document_type, flow, currency, amount, status, issued_at, due_at, paid_at, customer_email, data',
    )
    .eq('id', documentId)
    .or(ownerFilter)
    .neq('status', 'void')
    .maybeSingle();

  if (error) {
    console.error('[account document pdf]', error);
    return NextResponse.json({ error: 'Could not load this document.' }, { status: 500 });
  }
  if (!document) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  const logo = await loadInvoiceLogo(url.origin);

  try {
    const pdf = await generateFinancialDocumentPdf(document as any, logo);
    const filename = `${String(document.document_number).replace(/[^\w.-]+/g, '_')}.pdf`;
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (pdfError) {
    console.error('[account document pdf generation]', pdfError);
    return NextResponse.json({ error: 'Could not create this PDF.' }, { status: 500 });
  }
}
