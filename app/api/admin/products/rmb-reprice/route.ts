import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  buildAppliedProductReprice,
  buildProductRepriceRow,
  productHasRepriceChanges,
  type ProductRepriceInput,
  type ProductRepriceRow,
} from '@/lib/product-pricing';

function parseBuyRate(raw: string | null): number | null {
  if (!raw) return null;
  const rate = Number(raw);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

async function loadProductsForReprice(): Promise<ProductRepriceInput[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id, name, slug, price, compare_at_price, metadata, product_variants(id, price, metadata)')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as ProductRepriceInput[];
}

async function loadRepricePreview(buyRmbRate: number): Promise<ProductRepriceRow[]> {
  const products = await loadProductsForReprice();

  return products
    .filter((product) => productHasRepriceChanges(product, buyRmbRate))
    .map((product) => buildProductRepriceRow(product, buyRmbRate))
    .filter((row): row is ProductRepriceRow => row != null);
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
    const products = await loadProductsForReprice();
    const preview = await loadRepricePreview(buyRmbRate);
    const previewIds = new Set(preview.map((row) => row.id));
    const toApplyIds =
      selectedIds && selectedIds.length > 0
        ? selectedIds.filter((id) => previewIds.has(id))
        : Array.from(previewIds);

    if (toApplyIds.length === 0) {
      return NextResponse.json({ success: true, applied: 0, changes: [] });
    }

    const appliedChanges: ProductRepriceRow[] = [];

    for (const productId of toApplyIds) {
      const product = products.find((row) => row.id === productId);
      if (!product) continue;

      const applied = buildAppliedProductReprice(product, buyRmbRate);
      const previewRow = buildProductRepriceRow(product, buyRmbRate);
      if (!applied || !previewRow) continue;

      const existingMetadata =
        product.metadata && typeof product.metadata === 'object'
          ? (product.metadata as Record<string, unknown>)
          : {};

      const { error: productError } = await supabaseAdmin
        .from('products')
        .update({
          price: applied.price,
          compare_at_price: applied.compare_at_price,
          metadata: {
            ...existingMetadata,
            last_buy_rmb_rate: buyRmbRate,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);

      if (productError) {
        return NextResponse.json({ error: productError.message }, { status: 500 });
      }

      for (const variantUpdate of applied.variant_updates) {
        const variant = product.product_variants?.find((row) => row.id === variantUpdate.id);
        const variantMetadata =
          variant?.metadata && typeof variant.metadata === 'object'
            ? (variant.metadata as Record<string, unknown>)
            : {};

        await supabaseAdmin
          .from('product_variants')
          .update({
            price: variantUpdate.price,
            metadata: {
              ...variantMetadata,
              base_price_rmb: variantUpdate.base_price_rmb,
            },
          })
          .eq('id', variantUpdate.id);
      }

      appliedChanges.push(previewRow);
    }

    return NextResponse.json({
      success: true,
      applied: appliedChanges.length,
      buy_rmb_rate: buyRmbRate,
      changes: appliedChanges,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Apply failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
