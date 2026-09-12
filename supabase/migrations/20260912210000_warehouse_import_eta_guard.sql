-- Re-import must not restart arrival countdowns for packages that are already loaded
-- with the same load date. Only set ETA when an ETA is provided, when a package is
-- newly loaded, or when the loaded date itself changes.

DROP FUNCTION IF EXISTS public.import_warehouse_package_batch(jsonb, uuid, uuid);
DROP FUNCTION IF EXISTS public.import_warehouse_package_batch(jsonb, uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.import_warehouse_package(
  uuid, text, text, text, text, integer, numeric, text, numeric,
  timestamptz, timestamptz, timestamptz, text, text, uuid, uuid
);
DROP FUNCTION IF EXISTS public.import_warehouse_package(
  uuid, text, text, text, text, integer, numeric, text, numeric,
  timestamptz, timestamptz, timestamptz, text, text, uuid, uuid, integer
);

CREATE OR REPLACE FUNCTION public.import_warehouse_package(
  p_customer_user_id uuid,
  p_customer_email text,
  p_shipping_mark text,
  p_tracking_number text,
  p_description text,
  p_cartons integer,
  p_cbm numeric,
  p_goods_class text,
  p_custom_usd_per_cbm numeric,
  p_received_at timestamptz,
  p_loaded_at timestamptz,
  p_estimated_arrival_at timestamptz,
  p_vessel text,
  p_notes text,
  p_import_batch_id uuid,
  p_created_by uuid,
  p_transit_days integer DEFAULT NULL
)
RETURNS TABLE(inbound_package_id uuid, shipping_package_id uuid, was_existing boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inbound public.inbound_packages%ROWTYPE;
  v_package public.shipping_packages%ROWTYPE;
  v_package_id uuid;
  v_rate public.shipping_rate_board%ROWTYPE;
  v_tracking_id text;
  v_goods_class text;
  v_usd_per_cbm numeric;
  v_status text;
  v_estimated_arrival timestamptz;
  v_shipping_usd numeric;
  v_shipping_ghs numeric;
  v_transit_days integer;
  v_effective_loaded timestamptz;
BEGIN
  IF p_customer_user_id IS NULL OR btrim(COALESCE(p_tracking_number, '')) = '' THEN
    RAISE EXCEPTION 'Customer and tracking number are required';
  END IF;
  IF p_cbm IS NULL OR p_cbm <= 0 THEN
    RAISE EXCEPTION 'CBM must be greater than zero';
  END IF;

  v_goods_class := lower(btrim(COALESCE(p_goods_class, 'normal')));
  IF v_goods_class NOT IN ('normal', 'sensitive', 'heavy', 'bulk', 'custom') THEN
    RAISE EXCEPTION 'Unknown goods class: %', p_goods_class;
  END IF;

  SELECT * INTO v_rate
  FROM public.shipping_rate_board
  WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Publish the shipping rate board before importing packages';
  END IF;

  v_transit_days := COALESCE(
    NULLIF(p_transit_days, 0),
    v_rate.default_transit_days,
    45
  );
  IF v_transit_days < 1 OR v_transit_days > 180 THEN
    RAISE EXCEPTION 'Transit days must be between 1 and 180';
  END IF;

  v_usd_per_cbm := CASE v_goods_class
    WHEN 'sensitive' THEN v_rate.sensitive_usd_per_cbm
    WHEN 'heavy' THEN v_rate.heavy_usd_per_cbm
    WHEN 'bulk' THEN v_rate.bulk_usd_per_cbm
    WHEN 'custom' THEN p_custom_usd_per_cbm
    ELSE v_rate.normal_usd_per_cbm
  END;
  IF COALESCE(v_usd_per_cbm, 0) <= 0 THEN
    RAISE EXCEPTION 'A positive rate is required for % goods', v_goods_class;
  END IF;

  v_shipping_usd := round((p_cbm * v_usd_per_cbm)::numeric, 2);
  v_shipping_ghs := CASE
    WHEN COALESCE(v_rate.usd_to_ghs, 0) > 0
      THEN round((v_shipping_usd * v_rate.usd_to_ghs)::numeric, 2)
    ELSE NULL
  END;

  SELECT *
  INTO v_inbound
  FROM public.inbound_packages
  WHERE customer_user_id = p_customer_user_id
    AND lower(regexp_replace(supplier_tracking_number, '\s+', '', 'g'))
      = lower(regexp_replace(p_tracking_number, '\s+', '', 'g'))
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_effective_loaded := COALESCE(p_loaded_at, v_inbound.loaded_at);

    IF p_estimated_arrival_at IS NOT NULL THEN
      v_estimated_arrival := p_estimated_arrival_at;
    ELSIF p_loaded_at IS NOT NULL
      AND (
        v_inbound.loaded_at IS NULL
        OR date_trunc('day', v_inbound.loaded_at) IS DISTINCT FROM date_trunc('day', p_loaded_at)
      ) THEN
      v_estimated_arrival := p_loaded_at + make_interval(days => v_transit_days);
    ELSE
      v_estimated_arrival := NULL;
    END IF;

    UPDATE public.inbound_packages AS inbound
    SET
      customer_email = lower(p_customer_email),
      shipping_mark_snapshot = upper(btrim(p_shipping_mark)),
      description = COALESCE(NULLIF(btrim(p_description), ''), description),
      cartons = COALESCE(p_cartons, cartons),
      cbm = p_cbm,
      goods_class = v_goods_class,
      custom_usd_per_cbm = CASE WHEN v_goods_class = 'custom' THEN p_custom_usd_per_cbm ELSE NULL END,
      status = CASE WHEN inbound.shipping_package_id IS NULL THEN 'received' ELSE 'converted' END,
      received_at = COALESCE(p_received_at, received_at, now()),
      loaded_at = COALESCE(p_loaded_at, loaded_at),
      estimated_arrival_at = COALESCE(v_estimated_arrival, estimated_arrival_at),
      vessel = COALESCE(NULLIF(btrim(p_vessel), ''), vessel),
      notes = COALESCE(NULLIF(btrim(p_notes), ''), notes),
      source = 'warehouse_import',
      import_batch_id = p_import_batch_id,
      updated_at = now()
    WHERE id = v_inbound.id
    RETURNING * INTO v_inbound;

    IF v_inbound.shipping_package_id IS NOT NULL THEN
      SELECT * INTO v_package
      FROM public.shipping_packages
      WHERE id = v_inbound.shipping_package_id
      FOR UPDATE;

      IF v_package.shipping_payment_status <> 'not_billed'
         OR v_package.final_usd_to_ghs IS NOT NULL THEN
        IF p_cbm IS DISTINCT FROM v_package.cbm
           OR v_goods_class IS DISTINCT FROM v_package.goods_class THEN
          RAISE EXCEPTION 'Package % is already billed. Correct CBM or class from the shipping desk.', v_package.tracking_id;
        END IF;
      ELSE
        UPDATE public.shipping_packages
        SET
          package_name = COALESCE(NULLIF(btrim(p_description), ''), package_name),
          quantity = GREATEST(COALESCE(p_cartons, quantity, 1), 1),
          cbm = p_cbm,
          goods_class = v_goods_class,
          usd_per_cbm = v_usd_per_cbm,
          estimated_shipping_usd = v_shipping_usd,
          estimate_usd_to_ghs = NULLIF(v_rate.usd_to_ghs, 0),
          estimated_shipping_ghs = v_shipping_ghs,
          warehouse_received_at = COALESCE(p_received_at, warehouse_received_at),
          loaded_at = COALESCE(p_loaded_at, loaded_at),
          estimated_arrival_at = COALESCE(v_estimated_arrival, estimated_arrival_at),
          vessel = COALESCE(NULLIF(btrim(p_vessel), ''), vessel),
          status = CASE
            WHEN status IN ('received', 'loaded') AND v_effective_loaded IS NOT NULL
              THEN 'loaded'
            ELSE status
          END,
          notes = COALESCE(NULLIF(btrim(p_notes), ''), notes),
          updated_at = now()
        WHERE id = v_inbound.shipping_package_id;
      END IF;

      RETURN QUERY
        SELECT v_inbound.id, v_inbound.shipping_package_id, true;
      RETURN;
    END IF;
  ELSE
    v_estimated_arrival := COALESCE(
      p_estimated_arrival_at,
      CASE
        WHEN p_loaded_at IS NOT NULL
          THEN p_loaded_at + make_interval(days => v_transit_days)
        ELSE NULL
      END
    );

    INSERT INTO public.inbound_packages (
      customer_user_id, customer_email, shipping_mark_snapshot,
      supplier_tracking_number, description, cartons, cbm, goods_class,
      custom_usd_per_cbm, status, received_at, loaded_at,
      estimated_arrival_at, vessel, notes, source, import_batch_id, created_by
    )
    VALUES (
      p_customer_user_id, lower(p_customer_email), upper(btrim(p_shipping_mark)),
      btrim(p_tracking_number), NULLIF(btrim(p_description), ''), p_cartons,
      p_cbm, v_goods_class,
      CASE WHEN v_goods_class = 'custom' THEN p_custom_usd_per_cbm ELSE NULL END,
      'received', p_received_at, p_loaded_at, v_estimated_arrival,
      NULLIF(btrim(p_vessel), ''), NULLIF(btrim(p_notes), ''),
      'warehouse_import', p_import_batch_id, p_created_by
    )
    RETURNING * INTO v_inbound;
  END IF;

  v_status := CASE WHEN COALESCE(p_loaded_at, v_inbound.loaded_at) IS NOT NULL THEN 'loaded' ELSE 'received' END;
  v_tracking_id := 'SHP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));

  IF v_estimated_arrival IS NULL THEN
    v_estimated_arrival := COALESCE(
      p_estimated_arrival_at,
      CASE
        WHEN COALESCE(p_loaded_at, v_inbound.loaded_at) IS NOT NULL
          THEN COALESCE(p_loaded_at, v_inbound.loaded_at) + make_interval(days => v_transit_days)
        ELSE NULL
      END
    );
  END IF;

  INSERT INTO public.shipping_packages (
    order_id, order_item_id, customer_user_id, customer_email,
    tracking_id, package_name, goods_class, quantity, cbm,
    usd_per_cbm, estimated_shipping_usd, estimate_usd_to_ghs,
    estimated_shipping_ghs, status, warehouse_received_at, loaded_at,
    estimated_arrival_at, vessel, carrier_reference, notes, created_by
  )
  VALUES (
    NULL, NULL, p_customer_user_id, lower(p_customer_email),
    v_tracking_id, COALESCE(NULLIF(btrim(p_description), ''), 'Warehouse package'),
    v_goods_class, GREATEST(COALESCE(p_cartons, COALESCE(v_inbound.cartons, 1)), 1), p_cbm,
    v_usd_per_cbm, v_shipping_usd, NULLIF(v_rate.usd_to_ghs, 0),
    v_shipping_ghs, v_status, COALESCE(p_received_at, v_inbound.received_at, now()),
    COALESCE(p_loaded_at, v_inbound.loaded_at),
    v_estimated_arrival, COALESCE(NULLIF(btrim(p_vessel), ''), v_inbound.vessel),
    btrim(p_tracking_number),
    COALESCE(NULLIF(btrim(p_notes), ''), v_inbound.notes), p_created_by
  )
  RETURNING id INTO v_package_id;

  UPDATE public.inbound_packages
  SET status = 'converted', shipping_package_id = v_package_id, updated_at = now()
  WHERE id = v_inbound.id;

  RETURN QUERY SELECT v_inbound.id, v_package_id, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_warehouse_package_batch(
  p_rows jsonb,
  p_batch_id uuid,
  p_created_by uuid,
  p_transit_days integer DEFAULT NULL
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
  updated_count integer := 0;
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
        item ->> 'goodsClass',
        NULLIF(item ->> 'customUsdPerCbm', '')::numeric,
        NULLIF(item ->> 'receivedAt', '')::timestamptz,
        NULLIF(item ->> 'loadedAt', '')::timestamptz,
        NULLIF(item ->> 'estimatedArrivalAt', '')::timestamptz,
        item ->> 'vessel',
        item ->> 'notes',
        p_batch_id,
        p_created_by,
        COALESCE(NULLIF(item ->> 'transitDays', '')::integer, p_transit_days)
      );

      IF row_result.was_existing THEN
        updated_count := updated_count + 1;
      ELSE
        imported_count := imported_count + 1;
      END IF;

      results := results || jsonb_build_array(
        jsonb_build_object(
          'rowNumber', item ->> 'rowNumber',
          'trackingNumber', item ->> 'trackingNumber',
          'ok', true,
          'updated', row_result.was_existing,
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
    'updated', updated_count,
    'errors', error_count,
    'rows', results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_warehouse_package(
  uuid, text, text, text, text, integer, numeric, text, numeric,
  timestamptz, timestamptz, timestamptz, text, text, uuid, uuid, integer
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.import_warehouse_package(
  uuid, text, text, text, text, integer, numeric, text, numeric,
  timestamptz, timestamptz, timestamptz, text, text, uuid, uuid, integer
) TO service_role;

REVOKE ALL ON FUNCTION public.import_warehouse_package_batch(jsonb, uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.import_warehouse_package_batch(jsonb, uuid, uuid, integer)
  TO service_role;
