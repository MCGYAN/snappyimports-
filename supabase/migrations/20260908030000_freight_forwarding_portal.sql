-- Freight forwarding intake: customer shipping marks, China warehouse details,
-- inbound supplier parcels, and audited warehouse spreadsheet imports.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shipping_mark text;

CREATE OR REPLACE FUNCTION public.generate_shipping_mark()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := 'SNAPPY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE shipping_mark = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;

UPDATE public.profiles
SET shipping_mark = public.generate_shipping_mark()
WHERE shipping_mark IS NULL OR btrim(shipping_mark) = '';

ALTER TABLE public.profiles
  ALTER COLUMN shipping_mark SET DEFAULT public.generate_shipping_mark(),
  ALTER COLUMN shipping_mark SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_shipping_mark_unique_idx
  ON public.profiles (upper(shipping_mark));

CREATE OR REPLACE FUNCTION public.assign_profile_shipping_mark()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.shipping_mark IS NULL OR btrim(NEW.shipping_mark) = '' THEN
    NEW.shipping_mark := public.generate_shipping_mark();
  END IF;

  NEW.shipping_mark := upper(btrim(NEW.shipping_mark));

  IF TG_OP = 'UPDATE'
     AND OLD.shipping_mark IS DISTINCT FROM NEW.shipping_mark
     AND COALESCE(auth.role(), '') <> 'service_role' THEN
    NEW.shipping_mark := OLD.shipping_mark;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_profile_shipping_mark_trigger ON public.profiles;
CREATE TRIGGER assign_profile_shipping_mark_trigger
  BEFORE INSERT OR UPDATE OF shipping_mark ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_profile_shipping_mark();

CREATE TABLE IF NOT EXISTS public.china_warehouse_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  warehouse_name text NOT NULL DEFAULT 'Snappy China Warehouse',
  contact_name text,
  phone text,
  address_chinese text,
  address_english text,
  instructions text,
  is_active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.china_warehouse_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.warehouse_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  source_sheet text,
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  unmatched_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'completed_with_errors', 'failed')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.inbound_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_email text,
  shipping_mark_snapshot text NOT NULL,
  supplier_tracking_number text NOT NULL,
  supplier_name text,
  description text,
  cartons integer CHECK (cartons IS NULL OR cartons > 0),
  cbm numeric CHECK (cbm IS NULL OR cbm > 0),
  status text NOT NULL DEFAULT 'expected'
    CHECK (status IN ('expected', 'received', 'converted', 'cancelled')),
  received_at timestamptz,
  loaded_at timestamptz,
  estimated_arrival_at timestamptz,
  vessel text,
  notes text,
  source text NOT NULL DEFAULT 'customer'
    CHECK (source IN ('customer', 'warehouse_import', 'admin')),
  shipping_package_id uuid REFERENCES public.shipping_packages(id) ON DELETE SET NULL,
  import_batch_id uuid REFERENCES public.warehouse_import_batches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS inbound_packages_customer_tracking_unique_idx
  ON public.inbound_packages (
    customer_user_id,
    lower(regexp_replace(supplier_tracking_number, '\s+', '', 'g'))
  );

CREATE INDEX IF NOT EXISTS inbound_packages_customer_idx
  ON public.inbound_packages (customer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS inbound_packages_status_idx
  ON public.inbound_packages (status, received_at DESC);

CREATE INDEX IF NOT EXISTS warehouse_import_batches_created_idx
  ON public.warehouse_import_batches (created_at DESC);

ALTER TABLE public.china_warehouse_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbound_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers read own inbound packages" ON public.inbound_packages;
CREATE POLICY "Customers read own inbound packages"
  ON public.inbound_packages FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Customers register own inbound packages" ON public.inbound_packages;
CREATE POLICY "Customers register own inbound packages"
  ON public.inbound_packages FOR INSERT TO authenticated
  WITH CHECK (
    customer_user_id = auth.uid()
    AND status = 'expected'
    AND source = 'customer'
    AND shipping_package_id IS NULL
  );

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
            AND COALESCE((profiles.admin_permissions ->> 'orders')::boolean, false)
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
            AND COALESCE((profiles.admin_permissions ->> 'orders')::boolean, false)
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
            AND COALESCE((profiles.admin_permissions ->> 'orders')::boolean, false)
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
            AND COALESCE((profiles.admin_permissions ->> 'orders')::boolean, false)
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
            AND COALESCE((profiles.admin_permissions ->> 'orders')::boolean, false)
          )
        )
    )
  );

DROP TRIGGER IF EXISTS update_china_warehouse_settings_updated_at
  ON public.china_warehouse_settings;
CREATE TRIGGER update_china_warehouse_settings_updated_at
  BEFORE UPDATE ON public.china_warehouse_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_inbound_packages_updated_at
  ON public.inbound_packages;
CREATE TRIGGER update_inbound_packages_updated_at
  BEFORE UPDATE ON public.inbound_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomically match/create the inbound parcel and create its international
-- shipping record. Restricted to service-role callers (admin API).
CREATE OR REPLACE FUNCTION public.import_warehouse_package(
  p_customer_user_id uuid,
  p_customer_email text,
  p_shipping_mark text,
  p_tracking_number text,
  p_description text,
  p_cartons integer,
  p_cbm numeric,
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
  v_package_id uuid;
  v_rate public.shipping_rate_board%ROWTYPE;
  v_tracking_id text;
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

  SELECT *
  INTO v_inbound
  FROM public.inbound_packages
  WHERE customer_user_id = p_customer_user_id
    AND lower(regexp_replace(supplier_tracking_number, '\s+', '', 'g'))
      = lower(regexp_replace(p_tracking_number, '\s+', '', 'g'))
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_inbound.shipping_package_id IS NOT NULL THEN
    RETURN QUERY
      SELECT v_inbound.id, v_inbound.shipping_package_id, true;
    RETURN;
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.inbound_packages (
      customer_user_id, customer_email, shipping_mark_snapshot,
      supplier_tracking_number, description, cartons, cbm, status,
      received_at, loaded_at, estimated_arrival_at, vessel, notes,
      source, import_batch_id, created_by
    )
    VALUES (
      p_customer_user_id, lower(p_customer_email), upper(btrim(p_shipping_mark)),
      btrim(p_tracking_number), nullif(btrim(p_description), ''),
      p_cartons, p_cbm, 'received', p_received_at, p_loaded_at,
      p_estimated_arrival_at, nullif(btrim(p_vessel), ''),
      nullif(btrim(p_notes), ''), 'warehouse_import', p_import_batch_id, p_created_by
    )
    RETURNING * INTO v_inbound;
  ELSE
    UPDATE public.inbound_packages
    SET
      customer_email = lower(p_customer_email),
      shipping_mark_snapshot = upper(btrim(p_shipping_mark)),
      description = COALESCE(nullif(btrim(p_description), ''), description),
      cartons = COALESCE(p_cartons, cartons),
      cbm = p_cbm,
      status = 'received',
      received_at = COALESCE(p_received_at, received_at, now()),
      loaded_at = COALESCE(p_loaded_at, loaded_at),
      estimated_arrival_at = COALESCE(p_estimated_arrival_at, estimated_arrival_at),
      vessel = COALESCE(nullif(btrim(p_vessel), ''), vessel),
      notes = COALESCE(nullif(btrim(p_notes), ''), notes),
      source = 'warehouse_import',
      import_batch_id = p_import_batch_id,
      updated_at = now()
    WHERE id = v_inbound.id
    RETURNING * INTO v_inbound;
  END IF;

  SELECT * INTO v_rate
  FROM public.shipping_rate_board
  WHERE id = 1;

  IF NOT FOUND OR COALESCE(v_rate.normal_usd_per_cbm, 0) <= 0 THEN
    RAISE EXCEPTION 'Publish the shipping rate board before importing packages';
  END IF;

  v_status := CASE WHEN p_loaded_at IS NOT NULL THEN 'loaded' ELSE 'received' END;
  v_estimated_arrival := COALESCE(
    p_estimated_arrival_at,
    CASE
      WHEN p_loaded_at IS NOT NULL
        THEN p_loaded_at + make_interval(days => COALESCE(v_rate.default_transit_days, 45))
      ELSE NULL
    END
  );
  v_shipping_usd := round((p_cbm * v_rate.normal_usd_per_cbm)::numeric, 2);
  v_shipping_ghs := CASE
    WHEN COALESCE(v_rate.usd_to_ghs, 0) > 0
      THEN round((v_shipping_usd * v_rate.usd_to_ghs)::numeric, 2)
    ELSE NULL
  END;
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
    v_tracking_id, COALESCE(nullif(btrim(p_description), ''), 'Warehouse package'),
    'normal', GREATEST(COALESCE(p_cartons, 1), 1), p_cbm,
    v_rate.normal_usd_per_cbm, v_shipping_usd,
    NULLIF(v_rate.usd_to_ghs, 0), v_shipping_ghs, v_status,
    COALESCE(p_received_at, now()), p_loaded_at, v_estimated_arrival,
    nullif(btrim(p_vessel), ''), btrim(p_tracking_number),
    nullif(btrim(p_notes), ''), p_created_by
  )
  RETURNING id INTO v_package_id;

  UPDATE public.inbound_packages
  SET status = 'converted', shipping_package_id = v_package_id, updated_at = now()
  WHERE id = v_inbound.id;

  RETURN QUERY SELECT v_inbound.id, v_package_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.import_warehouse_package(
  uuid, text, text, text, text, integer, numeric, timestamptz,
  timestamptz, timestamptz, text, text, uuid, uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_warehouse_package(
  uuid, text, text, text, text, integer, numeric, timestamptz,
  timestamptz, timestamptz, text, text, uuid, uuid
) TO service_role;

COMMENT ON COLUMN public.profiles.shipping_mark IS
  'Permanent customer warehouse mark generated by Snappy.';
COMMENT ON TABLE public.inbound_packages IS
  'Supplier-to-China-warehouse parcels before or during conversion to international shipping.';
COMMENT ON TABLE public.warehouse_import_batches IS
  'Audit record for each warehouse spreadsheet import.';
