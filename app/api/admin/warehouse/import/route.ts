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
  match: 'matched' | 'unknown_mark' | 'duplicate';
};

function normalizedMark(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function normalizedTracking(value: string): string {
  return value.trim().replace(/\s+/g, '').toLowerCase();
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
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, shipping_mark');
  if (error) throw new Error('Could not load customer shipping marks.');

  const profileByMark = new Map(
    (profiles || [])
      .filter((profile: any) => profile.shipping_mark)
      .map((profile: any) => [
        normalizedMark(profile.shipping_mark),
        { id: profile.id as string, email: (profile.email as string | null) || null },
      ]),
  );

  const seen = new Set<string>();
  return rows.map((row) => {
    const profile = profileByMark.get(normalizedMark(row.shippingMark));
    const duplicateKey = `${profile?.id || normalizedMark(row.shippingMark)}:${normalizedTracking(
      row.trackingNumber,
    )}`;
    const duplicate = seen.has(duplicateKey);
    seen.add(duplicateKey);

    return {
      ...row,
      customerUserId: profile?.id || null,
      customerEmail: profile?.email || null,
      match: duplicate ? 'duplicate' : profile ? 'matched' : 'unknown_mark',
    };
  });
}

export async function POST(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
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
        row.match === 'matched' && Boolean(row.customerUserId),
    );
    const unmatchedRows = matchedRows.filter((row) => row.match === 'unknown_mark');
    const duplicateRows = matchedRows.filter((row) => row.match === 'duplicate');

    const summary = {
      fileName: file.name,
      sheetName: workbook.sheetName,
      sourceRows: workbook.sourceRows,
      packageRows: workbook.rows.length,
      ready: readyRows.length,
      unknownMarks: unmatchedRows.length,
      duplicates: duplicateRows.length,
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
        skipped_rows: workbook.skippedRows + duplicateRows.length,
        unmatched_rows: unmatchedRows.length,
        status: 'processing',
        summary: {
          preview: summary,
          unknownMarks: [...new Set(unmatchedRows.map((row) => row.shippingMark))].slice(0, 100),
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
    const existing = Number(result?.existing) || 0;
    const errors = Number(result?.errors) || 0;
    const failedRows = Array.isArray(result?.rows)
      ? result.rows.filter((row: any) => !row.ok).slice(0, 100)
      : [];

    await supabaseAdmin
      .from('warehouse_import_batches')
      .update({
        imported_rows: imported,
        error_rows: errors,
        status:
          errors > 0 || unmatchedRows.length > 0
            ? 'completed_with_errors'
            : 'completed',
        summary: {
          preview: summary,
          existing,
          failedRows,
          unknownMarks: [...new Set(unmatchedRows.map((row) => row.shippingMark))].slice(0, 100),
        },
      })
      .eq('id', batch.id);

    return NextResponse.json({
      success: true,
      mode: 'apply',
      batchId: batch.id,
      summary: { ...summary, imported, existing, errors },
      failedRows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read this workbook.';
    console.error('[warehouse import]', error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
