-- Minimal China to Ghana freight portal.
CREATE TABLE IF NOT EXISTS public.shipping_rate_board (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  usd_to_ghs numeric NOT NULL DEFAULT 0 CHECK (usd_to_ghs >= 0),
  normal_usd_per_cbm numeric NOT NULL DEFAULT 260 CHECK (normal_usd_per_cbm >= 0),
  sensitive_usd_per_cbm numeric NOT NULL DEFAULT 280 CHECK (sensitive_usd_per_cbm >= 0),
  heavy_usd_per_cbm numeric NOT NULL DEFAULT 300 CHECK (heavy_usd_per_cbm >= 0),
  bulk_usd_per_cbm numeric NOT NULL DEFAULT 240 CHECK (bulk_usd_per_cbm >= 0),
  default_transit_days integer NOT NULL DEFAULT 45 CHECK (default_transit_days BETWEEN 1 AND 180),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

INSERT INTO public.shipping_rate_board (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.shipping_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  tracking_id text NOT NULL UNIQUE,
  package_name text NOT NULL,
  goods_class text NOT NULL DEFAULT 'normal'
    CHECK (goods_class IN ('normal', 'sensitive', 'heavy', 'bulk', 'custom')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  length_m numeric CHECK (length_m IS NULL OR length_m > 0),
  width_m numeric CHECK (width_m IS NULL OR width_m > 0),
  height_m numeric CHECK (height_m IS NULL OR height_m > 0),
  cbm numeric NOT NULL CHECK (cbm > 0),
  usd_per_cbm numeric NOT NULL CHECK (usd_per_cbm >= 0),
  estimated_shipping_usd numeric NOT NULL CHECK (estimated_shipping_usd >= 0),
  estimate_usd_to_ghs numeric CHECK (estimate_usd_to_ghs IS NULL OR estimate_usd_to_ghs >= 0),
  estimated_shipping_ghs numeric CHECK (estimated_shipping_ghs IS NULL OR estimated_shipping_ghs >= 0),
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'loaded', 'in_transit', 'arrived', 'clearing', 'ready', 'delivered')),
  warehouse_received_at timestamptz,
  loaded_at timestamptz,
  estimated_arrival_at timestamptz,
  arrived_at timestamptz,
  vessel text,
  final_usd_to_ghs numeric CHECK (final_usd_to_ghs IS NULL OR final_usd_to_ghs > 0),
  final_shipping_ghs numeric CHECK (final_shipping_ghs IS NULL OR final_shipping_ghs >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS shipping_packages_order_idx
  ON public.shipping_packages (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shipping_packages_status_idx
  ON public.shipping_packages (status, estimated_arrival_at);

ALTER TABLE public.shipping_rate_board ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage shipping rate board" ON public.shipping_rate_board;
CREATE POLICY "Staff manage shipping rate board"
  ON public.shipping_rate_board
  FOR ALL
  TO authenticated
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

DROP POLICY IF EXISTS "Staff manage shipping packages" ON public.shipping_packages;
CREATE POLICY "Staff manage shipping packages"
  ON public.shipping_packages
  FOR ALL
  TO authenticated
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

DROP TRIGGER IF EXISTS update_shipping_rate_board_updated_at ON public.shipping_rate_board;
CREATE TRIGGER update_shipping_rate_board_updated_at
  BEFORE UPDATE ON public.shipping_rate_board
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_shipping_packages_updated_at ON public.shipping_packages;
CREATE TRIGGER update_shipping_packages_updated_at
  BEFORE UPDATE ON public.shipping_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
