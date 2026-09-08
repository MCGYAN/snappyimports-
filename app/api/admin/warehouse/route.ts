import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

function clean(value: unknown, max: number): string | null {
  const result = String(value ?? '').trim().slice(0, max);
  return result || null;
}

export async function GET(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const [
    { data: warehouse, error: warehouseError },
    { data: batches, error: batchError },
    { data: expectedPackages, error: expectedError },
    { data: customers, error: customerError },
  ] =
    await Promise.all([
      supabaseAdmin.from('china_warehouse_settings').select('*').eq('id', 1).single(),
      supabaseAdmin
        .from('warehouse_import_batches')
        .select(
          'id, file_name, source_sheet, total_rows, imported_rows, skipped_rows, unmatched_rows, error_rows, status, summary, created_at',
        )
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('inbound_packages')
        .select(
          'id, customer_email, shipping_mark_snapshot, supplier_tracking_number, supplier_name, description, notes, created_at',
        )
        .eq('status', 'expected')
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, phone, shipping_mark, created_at')
        .eq('role', 'customer')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

  if (warehouseError || batchError || expectedError || customerError) {
    console.error(
      '[admin warehouse]',
      warehouseError || batchError || expectedError || customerError,
    );
    return NextResponse.json({ error: 'Could not load warehouse setup.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    warehouse,
    batches: batches || [],
    expectedPackages: expectedPackages || [],
    customers: customers || [],
  });
}

export async function PUT(req: Request) {
  const auth = await verifyAuth(req, { requireModule: 'orders' });
  if (!auth.authenticated || !auth.user?.id) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const warehouseName = clean(body.warehouseName, 120);
  const contactName = clean(body.contactName, 120);
  const phone = clean(body.phone, 60);
  const addressChinese = clean(body.addressChinese, 1_500);
  const addressEnglish = clean(body.addressEnglish, 1_500);
  const instructions = clean(body.instructions, 1_500);
  const isActive = Boolean(body.isActive);

  if (!warehouseName) {
    return NextResponse.json({ error: 'Warehouse name is required.' }, { status: 400 });
  }
  if (isActive && (!contactName || !phone || (!addressChinese && !addressEnglish))) {
    return NextResponse.json(
      { error: 'Add a contact, phone number, and warehouse address before publishing.' },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from('china_warehouse_settings')
    .upsert({
      id: 1,
      warehouse_name: warehouseName,
      contact_name: contactName,
      phone,
      address_chinese: addressChinese,
      address_english: addressEnglish,
      instructions,
      is_active: isActive,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    })
    .select()
    .single();

  if (error) {
    console.error('[save warehouse settings]', error);
    return NextResponse.json({ error: 'Could not save warehouse details.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, warehouse: data });
}
