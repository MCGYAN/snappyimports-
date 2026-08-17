CREATE TABLE IF NOT EXISTS public.shipping_package_status_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_package_id uuid NOT NULL
    REFERENCES public.shipping_packages(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 300),
  corrected_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shipping_package_status_corrections_package_idx
  ON public.shipping_package_status_corrections (shipping_package_id, created_at DESC);

ALTER TABLE public.shipping_package_status_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage package status corrections"
  ON public.shipping_package_status_corrections;
CREATE POLICY "Owners manage package status corrections"
  ON public.shipping_package_status_corrections
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role::text = 'admin'
    )
  );

COMMENT ON TABLE public.shipping_package_status_corrections IS
  'Owner-only audit trail for guarded one-step package status corrections.';
