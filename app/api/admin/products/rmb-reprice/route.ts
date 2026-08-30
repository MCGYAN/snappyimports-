import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  buildProductRepriceRow,
  filterChangedRepriceRows,
  type ProductRepriceRow,
} from '@/lib/product-pricing';

function parseBuyRate(raw: string | null): number | null {
  if (!raw) return null;
  const rate = Number(raw);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

async function loadRepricePreview(buyRmbRate: number): Promise<ProductRepriceRow[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, name, slug, price, metadata')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data || [])
    .map((product) => buildProductRepriceRow(product, buyRmbRate))
    .filter((row): row is ProductRepriceRow => row != null);

  return filterChangedRepriceRows(rows);
}

/** GET ?buy_rmb_rate=0.558 — preview product price changes at a new Ghana buy rate */
export async function GET(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'products' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const buyRmbRate = parseBuyRate(new URL(req.url).searchParams.get('buy_rmb_rate'));
  if (buyRmbRate == null) {
    return NextResponse.json({ error: 'Valid buy_rmb_rate is required.' }, { status: 400 });
  }

  try {
    const changes = await loadRepricePreview(buyRmbRate);
    return NextResponse.json({
      success: true,
      buy_rmb_rate: buyRmbRate,
      count: changes.length,
      changes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Preview failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST { buy_rmb_rate, product_ids? } — apply repricing (all changed products or selected ids) */
export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'products' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  let body: { buy_rmb_rate?: number; product_ids?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const buyRmbRate = Number(body.buy_rmb_rate);
  if (!(buyRmbRate > 0)) {
    return NextResponse.json({ error: 'Valid buy_rmb_rate is required.' }, { status: 400 });
  }

  const selectedIds = Array.isArray(body.product_ids)
    ? body.product_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : null;

  try {
    const preview = await loadRepricePreview(buyRmbRate);
    const toApply =
      selectedIds && selectedIds.length > 0
        ? preview.filter((row) => selectedIds.includes(row.id))
        : preview;

    if (toApply.length === 0) {
      return NextResponse.json({ success: true, applied: 0, changes: [] });
    }

    const { data: products, error: loadError } = await supabaseAdmin
      .from('products')
      .select('id, metadata')
      .in(
        'id',
        toApply.map((row) => row.id),
      );

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 500 });
    }

    const metadataById = new Map((products || []).map((p) => [p.id, p.metadata]));

    for (const row of toApply) {
      const existingMetadata =
        metadataById.get(row.id) && typeof metadataById.get(row.id) === 'object'
          ? (metadataById.get(row.id) as Record<string, unknown>)
          : {};

      const { error: productError } = await supabaseAdmin
        .from('products')
        .update({
          price: row.new_price,
          metadata: {
            ...existingMetadata,
            base_price_rmb: row.base_price_rmb,
            last_buy_rmb_rate: buyRmbRate,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (productError) {
        return NextResponse.json({ error: productError.message }, { status: 500 });
      }

      await supabaseAdmin.from('product_variants').update({ price: row.new_price }).eq('product_id', row.id);
    }

    return NextResponse.json({
      success: true,
      applied: toApply.length,
      buy_rmb_rate: buyRmbRate,
      changes: toApply,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Apply failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
