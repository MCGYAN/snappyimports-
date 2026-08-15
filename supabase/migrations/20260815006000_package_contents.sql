-- A physical package can contain several order items, and one order item can
-- be split across several packages. Keep the legacy order_item_id column for
-- compatibility, but make this junction table the source of truth.

ALTER TABLE public.shipping_packages
  ADD COLUMN IF NOT EXISTS carrier_reference text;

CREATE TABLE IF NOT EXISTS public.shipping_package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.shipping_packages(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (package_id, order_item_id)
);

CREATE INDEX IF NOT EXISTS shipping_package_items_package_idx
  ON public.shipping_package_items (package_id);
CREATE INDEX IF NOT EXISTS shipping_package_items_order_item_idx
  ON public.shipping_package_items (order_item_id);

INSERT INTO public.shipping_package_items (package_id, order_item_id, quantity)
SELECT id, order_item_id, GREATEST(quantity, 1)
FROM public.shipping_packages
WHERE order_item_id IS NOT NULL
ON CONFLICT (package_id, order_item_id) DO NOTHING;

ALTER TABLE public.shipping_package_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage shipping package contents"
  ON public.shipping_package_items;
CREATE POLICY "Staff manage shipping package contents"
  ON public.shipping_package_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
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
      SELECT 1
      FROM public.profiles
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

-- Replace a package's contents in one database transaction. The API validates
-- ownership and remaining quantities before calling this function.
CREATE OR REPLACE FUNCTION public.replace_shipping_package_items(
  p_package_id uuid,
  p_items jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.shipping_package_items
  WHERE package_id = p_package_id;

  INSERT INTO public.shipping_package_items (package_id, order_item_id, quantity)
  SELECT
    p_package_id,
    (entry ->> 'order_item_id')::uuid,
    (entry ->> 'quantity')::integer
  FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS entry;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_shipping_package_items(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_shipping_package_items(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.replace_shipping_package_items(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_shipping_package_items(uuid, jsonb) TO service_role;
