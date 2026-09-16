import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { SITE_INVOICE_LOGO_PATH, SITE_INVOICE_WATERMARK_PATH } from '@/lib/brand';
import { generateFinancialDocumentPdf } from '@/lib/server-financial-document-pdf';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

let cachedLogo: ArrayBuffer | null | undefined;
let cachedWatermark: ArrayBuffer | null | undefined;

async function loadInvoiceLogo(origin: string): Promise<ArrayBuffer | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const logoResponse = await fetch(new URL(SITE_INVOICE_LOGO_PATH, origin), {
      cache: 'force-cache',
    });
    cachedLogo = logoResponse.ok ? await logoResponse.arrayBuffer() : null;
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

async function loadInvoiceWatermark(origin: string): Promise<ArrayBuffer | null> {
  if (cachedWatermark !== undefined) return cachedWatermark;
  try {
    const wmResponse = await fetch(new URL(SITE_INVOICE_WATERMARK_PATH, origin), {
      cache: 'force-cache',
    });
    cachedWatermark = wmResponse.ok ? await wmResponse.arrayBuffer() : null;
  } catch {
    cachedWatermark = null;
  }
  return cachedWatermark;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const documentId = String(id || '').trim();
  if (!documentId) {
    return NextResponse.json({ error: 'Document is required.' }, { status: 400 });
  }

  const { data: document, error } = await supabaseAdmin
    .from('financial_documents')
    .select(
      'id, document_number, document_type, flow, currency, amount, status, issued_at, due_at, paid_at, customer_email, data',
    )
    .eq('id', documentId)
    .neq('status', 'void')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Could not load this document.' }, { status: 500 });
  }
  if (!document) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  const url = new URL(req.url);
  const logo = await loadInvoiceLogo(url.origin);
  const watermark = await loadInvoiceWatermark(url.origin);

  try {
    const pdf = await generateFinancialDocumentPdf(document as any, logo, watermark);
    const filename = `${String(document.document_number).replace(/[^\w.-]+/g, '_')}.pdf`;
    const asDownload = url.searchParams.get('download') === '1';
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (pdfError) {
    console.error('[admin invoice pdf]', pdfError);
    return NextResponse.json({ error: 'Could not create this PDF.' }, { status: 500 });
  }
}
