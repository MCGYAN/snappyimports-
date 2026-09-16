import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { createManualInvoice } from '@/lib/financial-documents';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 40));

  const { data, error } = await supabaseAdmin
    .from('financial_documents')
    .select(
      'id, document_number, document_type, flow, currency, amount, status, issued_at, due_at, paid_at, customer_email, data, created_at',
    )
    .eq('flow', 'manual')
    .eq('document_type', 'invoice')
    .neq('status', 'void')
    .order('issued_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message || 'Could not load invoices.' }, { status: 500 });
  }

  return NextResponse.json({ invoices: data || [] });
}

export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const customerName = String(body?.customerName || '').trim();
  const customerEmail = String(body?.customerEmail || '').trim() || null;
  const customerPhone = String(body?.customerPhone || '').trim() || null;
  const currency = String(body?.currency || 'GHS').trim().toUpperCase() || 'GHS';
  const notes = String(body?.notes || '').trim() || null;
  const dueAtRaw = String(body?.dueAt || '').trim();
  const dueAt = dueAtRaw ? new Date(dueAtRaw).toISOString() : null;

  const items = Array.isArray(body?.items)
    ? body.items.map((item: any) => ({
        product_name: String(item?.product_name || item?.description || '').trim(),
        quantity: Number(item?.quantity) || 1,
        unit_price: Number(item?.unit_price ?? item?.unitPrice) || 0,
        detail: String(item?.detail || item?.variant_name || '').trim() || null,
      }))
    : [];

  if (!customerName) {
    return NextResponse.json({ error: 'Customer name is required.' }, { status: 400 });
  }
  if (!items.length) {
    return NextResponse.json({ error: 'Add at least one line item.' }, { status: 400 });
  }

  try {
    const invoice = await createManualInvoice({
      customerName,
      customerEmail,
      customerPhone,
      currency,
      dueAt: Number.isNaN(Date.parse(dueAt || '')) ? null : dueAt,
      notes,
      items,
      createdBy: auth.user.id,
    });
    return NextResponse.json({ invoice });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Could not create invoice.' },
      { status: 400 },
    );
  }
}
