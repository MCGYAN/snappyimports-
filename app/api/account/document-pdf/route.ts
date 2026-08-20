import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { SITE_LOGO_LIGHT_BG_PATH } from '@/lib/brand';
import {
  signDocumentPdfAccess,
  verifyDocumentPdfAccess,
} from '@/lib/document-pdf-access';
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

async function loadOwnedDocument(opts: {
  documentId: string;
  userId: string;
  email?: string | null;
}) {
  const email = opts.email?.trim().toLowerCase();
  const ownerFilter = email
    ? `customer_user_id.eq.${opts.userId},customer_email.ilike.${email}`
    : `customer_user_id.eq.${opts.userId}`;

  return supabaseAdmin
    .from('financial_documents')
    .select(
      'id, document_number, document_type, flow, currency, amount, status, issued_at, due_at, paid_at, customer_email, data',
    )
    .eq('id', opts.documentId)
    .or(ownerFilter)
    .neq('status', 'void')
    .maybeSingle();
}

/** Create a short-lived HTTPS link phones can open or send to Telegram. */
export async function POST(req: Request) {
  const auth = await verifyAuth(req);
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const documentId = typeof body?.id === 'string' ? body.id.trim() : '';
  if (!documentId) {
    return NextResponse.json({ error: 'Document is required.' }, { status: 400 });
  }

  const { data: document, error } = await loadOwnedDocument({
    documentId,
    userId: auth.user.id,
    email: auth.user.email,
  });

  if (error) {
    console.error('[account document pdf link]', error);
    return NextResponse.json({ error: 'Could not load this document.' }, { status: 500 });
  }
  if (!document) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  const token = signDocumentPdfAccess({
    userId: auth.user.id,
    documentId: document.id,
  });
  const url = new URL(req.url);
  const pdfPath = `/api/account/document-pdf?id=${encodeURIComponent(document.id)}&t=${encodeURIComponent(token)}`;
  const absoluteUrl = new URL(pdfPath, url.origin).toString();
  const filename = `${String(document.document_number).replace(/[^\w.-]+/g, '_')}.pdf`;

  return NextResponse.json({
    url: absoluteUrl,
    filename,
    documentNumber: document.document_number,
    documentType: document.document_type,
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const documentId = url.searchParams.get('id')?.trim();
  if (!documentId) {
    return NextResponse.json({ error: 'Document is required.' }, { status: 400 });
  }

  const tokenInfo = verifyDocumentPdfAccess(url.searchParams.get('t'));
  let userId: string | null = null;
  let email: string | null = null;

  if (tokenInfo) {
    if (tokenInfo.documentId !== documentId) {
      return NextResponse.json({ error: 'Invalid download link.' }, { status: 403 });
    }
    userId = tokenInfo.userId;
    try {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      email = userData.user?.email ?? null;
    } catch {
      email = null;
    }
  } else {
    const auth = await verifyAuth(req);
    if (!auth.authenticated || !auth.user?.id) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }
    userId = auth.user.id;
    email = auth.user.email ?? null;
  }

  if (!userId) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  }

  const { data: document, error } = await loadOwnedDocument({
    documentId,
    userId,
    email,
  });

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
    // inline so Chrome/Safari display the PDF instead of a blank download tab.
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
    console.error('[account document pdf generation]', pdfError);
    return NextResponse.json({ error: 'Could not create this PDF.' }, { status: 500 });
  }
}
