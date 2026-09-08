-- Client feedback upgrade: surname-based marks, richer warehouse contacts,
-- goods classes, and idempotent received-to-loaded workbook updates.

ALTER TABLE public.china_warehouse_settings
  ADD COLUMN IF NOT EXISTS entry_numbers text,
  ADD COLUMN IF NOT EXISTS tracking_whatsapp text;

UPDATE public.china_warehouse_settings
SET
  warehouse_name = CASE
    WHEN warehouse_name IS NULL OR warehouse_name = 'Snappy China Warehouse'
      THEN 'Snappy China Warehouse, Lide Warehouse'
    ELSE warehouse_name
  END,
  address_english = COALESCE(
    NULLIF(address_english, ''),
    'Warehouse No. 1, Lide Warehouse, No. 2, Wuyi Village Avenue, Lishui Town, Foshan City.'
  ),
  address_chinese = COALESCE(
    NULLIF(address_chinese, ''),
    '佛山市里水镇五一村大道2号里德仓1号仓'
  ),
  entry_numbers = COALESCE(NULLIF(entry_numbers, ''), '18620853884; 18620788554'),
  tracking_whatsapp = COALESCE(NULLIF(tracking_whatsapp, ''), '+8618620853884'),
  instructions = COALESCE(
    NULLIF(instructions, ''),
    'Put the customer shipping mark and telephone number clearly on every carton.'
  )
WHERE id = 1;

ALTER TABLE public.inbound_packages
  ADD COLUMN IF NOT EXISTS goods_class text NOT NULL DEFAULT 'normal'
    CHECK (goods_class IN ('normal', 'sensitive', 'heavy', 'bulk', 'custom')),
  ADD COLUMN IF NOT EXISTS custom_usd_per_cbm numeric
    CHECK (custom_usd_per_cbm IS NULL OR custom_usd_per_cbm > 0);

ALTER TABLE public.warehouse_import_batches
  ADD COLUMN IF NOT EXISTS updated_rows integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.surname_shipping_mark(
  p_full_name text,
  p_email text,
  p_user_id uuid
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  source_name text;
  name_parts text[];
  surname text;
  suffix text;
BEGIN
  source_name := COALESCE(
    NULLIF(btrim(p_full_name), ''),
    NULLIF(split_part(COALESCE(p_email, ''), '@', 1), ''),
    'TRADER'
  );
  name_parts := regexp_split_to_array(source_name, '\s+');
  surname := upper(regexp_replace(name_parts[array_length(name_parts, 1)], '[^a-zA-Z0-9]', '', 'g'));
  IF surname = '' THEN surname := 'TRADER'; END IF;

  suffix := lpad(
    (
      (('x' || substr(md5(COALESCE(p_user_id::text, source_name)), 1, 8))::bit(32)::bigint % 10000)
    )::text,
    4,
    '0'
  );
  RETURN 'SNAPPY ' || surname || ' ' || suffix;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_profile_shipping_mark()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.shipping_mark IS NULL OR btrim(NEW.shipping_mark) = '' THEN
    NEW.shipping_mark := public.surname_shipping_mark(NEW.full_name, NEW.email, NEW.id);
  END IF;

  NEW.shipping_mark := upper(btrim(NEW.shipping_mark));

  IF TG_OP = 'UPDATE'
     AND OLD.shipping_mark IS DISTINCT FROM NEW.shipping_mark
     AND current_user NOT IN ('postgres', 'service_role')
     AND COALESCE(auth.role(), '') <> 'service_role' THEN
    NEW.shipping_mark := OLD.shipping_mark;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.profiles AS profile
SET
  full_name = COALESCE(
    NULLIF(profile.full_name, ''),
    NULLIF(auth_user.raw_user_meta_data ->> 'full_name', ''),
    btrim(
      concat_ws(
        ' ',
        auth_user.raw_user_meta_data ->> 'first_name',
        auth_user.raw_user_meta_data ->> 'last_name'
      )
    )
  ),
  phone = COALESCE(
    NULLIF(profile.phone, ''),
    NULLIF(auth_user.raw_user_meta_data ->> 'phone', ''),
    auth_user.phone
  ),
  shipping_mark = public.surname_shipping_mark(
    COALESCE(
      NULLIF(profile.full_name, ''),
      NULLIF(auth_user.raw_user_meta_data ->> 'full_name', ''),
      btrim(
        concat_ws(
          ' ',
          auth_user.raw_user_meta_data ->> 'first_name',
          auth_user.raw_user_meta_data ->> 'last_name'
        )
      )
    ),
    profile.email,
    profile.id
  )
FROM auth.users AS auth_user
WHERE auth_user.id = profile.id
  AND profile.role::text = 'customer';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  customer_name text;
  customer_phone text;
BEGIN
  customer_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    btrim(
      concat_ws(
        ' ',
        NEW.raw_user_meta_data ->> 'first_name',
        NEW.raw_user_meta_data ->> 'last_name'
      )
    )
  );
  customer_phone := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'phone', ''),
    NEW.phone
  );

  INSERT INTO public.profiles (id, email, role, full_name, phone, shipping_mark)
  VALUES (
    NEW.id,
    NEW.email,
    'customer',
    NULLIF(customer_name, ''),
    customer_phone,
    public.surname_shipping_mark(customer_name, NEW.email, NEW.id)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.import_warehouse_package_batch(jsonb, uuid, uuid);
DROP FUNCTION IF EXISTS public.import_warehouse_package(
  uuid, text, text, text, text, integer, numeric, timestamptz,
  timestamptz, timestamptz, text, text, uuid, uuid
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
  p_created_by uuid
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

  v_estimated_arrival := COALESCE(
    p_estimated_arrival_at,
    CASE
      WHEN p_loaded_at IS NOT NULL
        THEN p_loaded_at + make_interval(days => COALESCE(v_rate.default_transit_days, 45))
      ELSE NULL
    END
  );
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
            WHEN status IN ('received', 'loaded') AND COALESCE(p_loaded_at, loaded_at) IS NOT NULL
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

  v_status := CASE WHEN p_loaded_at IS NOT NULL THEN 'loaded' ELSE 'received' END;
  v_tracking_id := 'SHP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));

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
    v_goods_class, GREATEST(COALESCE(p_cartons, 1), 1), p_cbm,
    v_usd_per_cbm, v_shipping_usd, NULLIF(v_rate.usd_to_ghs, 0),
    v_shipping_ghs, v_status, COALESCE(p_received_at, now()), p_loaded_at,
    v_estimated_arrival, NULLIF(btrim(p_vessel), ''), btrim(p_tracking_number),
    NULLIF(btrim(p_notes), ''), p_created_by
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
        p_created_by
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
  timestamptz, timestamptz, timestamptz, text, text, uuid, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_warehouse_package(
  uuid, text, text, text, text, integer, numeric, text, numeric,
  timestamptz, timestamptz, timestamptz, text, text, uuid, uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.import_warehouse_package_batch(jsonb, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_warehouse_package_batch(jsonb, uuid, uuid)
  TO service_role;

DROP POLICY IF EXISTS "Staff manage inbound packages" ON public.inbound_packages;
CREATE POLICY "Staff manage inbound packages"
  ON public.inbound_packages FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role::text = 'admin'
          OR (
            profiles.role::text = 'staff'
            AND COALESCE((profiles.admin_permissions ->> 'warehouse')::boolean, false)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role::text = 'admin'
          OR (
            profiles.role::text = 'staff'
            AND COALESCE((profiles.admin_permissions ->> 'warehouse')::boolean, false)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Staff manage China warehouse settings" ON public.china_warehouse_settings;
CREATE POLICY "Staff manage China warehouse settings"
  ON public.china_warehouse_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role::text = 'admin'
          OR (
            profiles.role::text = 'staff'
            AND COALESCE((profiles.admin_permissions ->> 'warehouse')::boolean, false)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role::text = 'admin'
          OR (
            profiles.role::text = 'staff'
            AND COALESCE((profiles.admin_permissions ->> 'warehouse')::boolean, false)
          )
        )
    )
  );

DROP POLICY IF EXISTS "Staff read warehouse import batches" ON public.warehouse_import_batches;
CREATE POLICY "Staff read warehouse import batches"
  ON public.warehouse_import_batches FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role::text = 'admin'
          OR (
            profiles.role::text = 'staff'
            AND COALESCE((profiles.admin_permissions ->> 'warehouse')::boolean, false)
          )
        )
    )
  );
