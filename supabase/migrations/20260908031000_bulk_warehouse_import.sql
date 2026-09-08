-- One service-role RPC imports a validated workbook in a database transaction.
-- Each row uses a subtransaction so a malformed row is reported without
-- duplicating or corrupting successfully imported rows.

CREATE OR REPLACE FUNCTION public.import_warehouse_package_batch(
  p_rows jsonb,
  p_batch_id uuid,
  p_created_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  row_result record;
  results jsonb := '[]'::jsonb;
  imported_count integer := 0;
  existing_count integer := 0;
  error_count integer := 0;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Rows must be a JSON array';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      SELECT *
      INTO row_result
      FROM public.import_warehouse_package(
        (item ->> 'customerUserId')::uuid,
        item ->> 'customerEmail',
        item ->> 'shippingMark',
        item ->> 'trackingNumber',
        item ->> 'description',
        NULLIF(item ->> 'cartons', '')::integer,
        NULLIF(item ->> 'cbm', '')::numeric,
        NULLIF(item ->> 'receivedAt', '')::timestamptz,
        NULLIF(item ->> 'loadedAt', '')::timestamptz,
        NULLIF(item ->> 'estimatedArrivalAt', '')::timestamptz,
        item ->> 'vessel',
        item ->> 'notes',
        p_batch_id,
        p_created_by
      );

      IF row_result.was_existing THEN
        existing_count := existing_count + 1;
      ELSE
        imported_count := imported_count + 1;
      END IF;

      results := results || jsonb_build_array(
        jsonb_build_object(
          'rowNumber', item ->> 'rowNumber',
          'trackingNumber', item ->> 'trackingNumber',
          'ok', true,
          'existing', row_result.was_existing,
          'shippingPackageId', row_result.shipping_package_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      results := results || jsonb_build_array(
        jsonb_build_object(
          'rowNumber', item ->> 'rowNumber',
          'trackingNumber', item ->> 'trackingNumber',
          'ok', false,
          'error', SQLERRM
        )
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'imported', imported_count,
    'existing', existing_count,
    'errors', error_count,
    'rows', results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_warehouse_package_batch(jsonb, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_warehouse_package_batch(jsonb, uuid, uuid)
  TO service_role;
