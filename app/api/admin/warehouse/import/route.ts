import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseWarehouseWorkbook, type WarehouseWorkbookRow } from '@/lib/warehouse-workbook';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const PREVIEW_LIMIT = 250;

type MatchedRow = WarehouseWorkbookRow & {
  customerUserId: string | null;
  customerEmail: string | null;
  goodsClass: 'normal' | 'sensitive' | 'heavy' | 'bulk' | 'custom' | 'invalid';
  usdPerCbm: number | null;
  estimatedShippingUsd: number | null;
  match: 'matched' | 'update' | 'unknown_mark' | 'duplicate' | 'invalid_class';
};

function normalizedMark(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizedTracking(value: string): string {
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

function normalizedGoodsClass(
  value: string,
): 'normal' | 'sensitive' | 'heavy' | 'bulk' | 'custom' | 'invalid' {
  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (!normalized || ['normal', 'normalproduct', 'yes', 'true'].includes(normalized)) return 'normal';
  if (['sensitive', 'sensitiveproduct', 'restricted'].includes(normalized)) return 'sensitive';
  if (['heavy', 'heavyproduct'].includes(normalized)) return 'heavy';
  if (['bulk', 'bulkcargo', 'bulkproduct'].includes(normalized)) return 'bulk';
  if (normalized === 'custom') return 'custom';
  return 'invalid';
}

async function parseRequestFile(req: Request) {
  const form = await req.formData();
  const file = form.get('file');
  const mode = String(form.get('mode') || 'preview');
  if (!(file instanceof File)) throw new Error('Choose an Excel workbook.');
  if (!/\.xlsx$/i.test(file.name)) throw new Error('Upload an .xlsx workbook.');
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
    throw new Error('Workbook must be smaller than 4 MB.');
  }
  const workbook = await parseWarehouseWorkbook(await file.arrayBuffer());
  return { file, mode, workbook };
}

async function matchRows(rows: WarehouseWorkbookRow[]): Promise<MatchedRow[]> {
  const [
    { data: profiles, error: profileError },
    { data: existingPackages, error: existingError },
    { data: board, error: boardError },
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, email, shipping_mark'),
    supabaseAdmin
      .from('inbound_packages')
      .select('customer_user_id, supplier_tracking_number, shipping_package_id')
      .limit(10_000),
    supabaseAdmin.from('shipping_rate_board').select('*').eq('id', 1).single(),
  ]);
  if (profileError || existingError || boardError) {
    throw new Error('Could not load customer marks and shipping rates.');
  }

  const profileByMark = new Map(
    (profiles || [])
      .filter((profile: any) => profile.shipping_mark)
      .map((profile: any) => [
        normalizedMark(profile.shipping_mark),
        { id: profile.id as string, email: (profile.email as string | null) || null },
      ]),
  );
  const existingKeys = new Set(
    (existingPackages || []).map(
      (row: any) =>
        `${row.customer_user_id}:${normalizedTracking(row.supplier_tracking_number || '')}`,
    ),
  );

  const seen = new Set<string>();
  return rows.map((row) => {
    const profile = profileByMark.get(normalizedMark(row.shippingMark));
    const goodsClass = normalizedGoodsClass(row.goodsClass);
    const duplicateKey = `${profile?.id || normalizedMark(row.shippingMark)}:${normalizedTracking(
      row.trackingNumber,
    )}`;
    const duplicate = seen.has(duplicateKey);
    seen.add(duplicateKey);
    const isUpdate = Boolean(profile && existingKeys.has(duplicateKey));
    const rate =
      goodsClass === 'custom'
        ? row.customUsdPerCbm
        : goodsClass === 'sensitive'
          ? Number(board.sensitive_usd_per_cbm)
          : goodsClass === 'heavy'
            ? Number(board.heavy_usd_per_cbm)
            : goodsClass === 'bulk'
              ? Number(board.bulk_usd_per_cbm)
              : goodsClass === 'normal'
                ? Number(board.normal_usd_per_cbm)
                : null;
    const invalidClass = goodsClass === 'invalid' || (goodsClass === 'custom' && !rate);

    return {
      ...row,
      goodsClass,
      usdPerCbm: rate,
      estimatedShippingUsd:
        rate && row.cbm ? Number((Number(row.cbm) * Number(rate)).toFixed(2)) : null,
      customerUserId: profile?.id || null,
      customerEmail: profile?.email || null,
      match: duplicate
        ? 'duplicate'
        : !profile
          ? 'unknown_mark'
          : invalidClass
            ? 'invalid_class'
            : isUpdate
              ? 'update'
              : 'matched',
    };
  });
}

export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'warehouse' });
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  const rate = checkRateLimit(`warehouse-import:${auth.user.id}`, RATE_LIMITS.productImport);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many workbook uploads. Try again later.' }, { status: 429 });
  }

  try {
    const { file, mode, workbook } = await parseRequestFile(req);
    const matchedRows = await matchRows(workbook.rows);
    const readyRows = matchedRows.filter(
      (row): row is MatchedRow & { customerUserId: string } =>
        ['matched', 'update'].includes(row.match) && Boolean(row.customerUserId),
    );
    const unmatchedRows = matchedRows.filter((row) => row.match === 'unknown_mark');
    const duplicateRows = matchedRows.filter((row) => row.match === 'duplicate');
    const invalidClassRows = matchedRows.filter((row) => row.match === 'invalid_class');
    const updateRows = matchedRows.filter((row) => row.match === 'update');

    const summary = {
      fileName: file.name,
      sheetName: workbook.sheetName,
      sourceRows: workbook.sourceRows,
      packageRows: workbook.rows.length,
      ready: readyRows.length,
      newPackages: readyRows.length - updateRows.length,
      updates: updateRows.length,
      unknownMarks: unmatchedRows.length,
      duplicates: duplicateRows.length,
      invalidClasses: invalidClassRows.length,
      skipped: workbook.skippedRows,
    };

    if (mode !== 'apply') {
      return NextResponse.json({
        success: true,
        mode: 'preview',
        summary,
        rows: matchedRows.slice(0, PREVIEW_LIMIT),
        previewLimited: matchedRows.length > PREVIEW_LIMIT,
      });
    }

    if (readyRows.length === 0) {
      return NextResponse.json(
        { error: 'No rows match a registered Snappy shipping mark.', summary },
        { status: 400 },
      );
    }

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('warehouse_import_batches')
      .insert({
        file_name: file.name.slice(0, 255),
        source_sheet: workbook.sheetName.slice(0, 120),
        total_rows: workbook.rows.length,
        skipped_rows: workbook.skippedRows + duplicateRows.length + invalidClassRows.length,
        unmatched_rows: unmatchedRows.length,
        status: 'processing',
        summary: {
          preview: summary,
          unknownMarks: [...new Set(unmatchedRows.map((row) => row.shippingMark))].slice(0, 100),
          invalidClasses: [...new Set(invalidClassRows.map((row) => row.goodsClass))],
        },
        created_by: auth.user.id,
      })
      .select('id')
      .single();
    if (batchError || !batch) throw new Error('Could not start the import batch.');

    const rpcRows = readyRows.map((row) => ({
      rowNumber: row.rowNumber,
      customerUserId: row.customerUserId,
      customerEmail: row.customerEmail,
      shippingMark: row.shippingMark,
      trackingNumber: row.trackingNumber,
      description: row.description,
      cartons: row.cartons,
      cbm: row.cbm,
      goodsClass: row.goodsClass,
      customUsdPerCbm: row.customUsdPerCbm,
      receivedAt: row.receivedAt,
      loadedAt: row.loadedAt,
      estimatedArrivalAt: row.estimatedArrivalAt,
      vessel: row.vessel,
      notes: row.notes,
    }));

    const { data: result, error: importError } = await supabaseAdmin.rpc(
      'import_warehouse_package_batch',
      {
        p_rows: rpcRows,
        p_batch_id: batch.id,
        p_created_by: auth.user.id,
      },
    );

    if (importError) {
      await supabaseAdmin
        .from('warehouse_import_batches')
        .update({
          status: 'failed',
          error_rows: readyRows.length,
          summary: { preview: summary, error: importError.message },
        })
        .eq('id', batch.id);
      throw new Error(importError.message);
    }

    const imported = Number(result?.imported) || 0;
    const updated = Number(result?.updated) || 0;
    const errors = Number(result?.errors) || 0;
    const failedRows = Array.isArray(result?.rows)
      ? result.rows.filter((row: any) => !row.ok).slice(0, 100)
      : [];

    await supabaseAdmin
      .from('warehouse_import_batches')
      .update({
        imported_rows: imported,
        updated_rows: updated,
        error_rows: errors,
        status:
          errors > 0 || unmatchedRows.length > 0 || invalidClassRows.length > 0
            ? 'completed_with_errors'
            : 'completed',
        summary: {
          preview: summary,
          updated,
          failedRows,
          unknownMarks: [...new Set(unmatchedRows.map((row) => row.shippingMark))].slice(0, 100),
        },
      })
      .eq('id', batch.id);

    return NextResponse.json({
      success: true,
      mode: 'apply',
      batchId: batch.id,
      summary: { ...summary, imported, updated, errors },
      failedRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read this workbook.';
    console.error('[warehouse import]', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
