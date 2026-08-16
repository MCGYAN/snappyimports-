CREATE TABLE IF NOT EXISTS public.delivery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_package_id uuid NOT NULL UNIQUE
    REFERENCES public.shipping_packages(id) ON DELETE CASCADE,
  customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('pickup', 'delivery')),
  preferred_date date NOT NULL,
  preferred_time_window text,
  delivery_address text,
  city text,
  region text,
  phone text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'contacting', 'confirmed', 'completed', 'cancelled')),
  admin_notes text,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    request_type = 'pickup'
    OR (
      length(trim(COALESCE(delivery_address, ''))) > 0
      AND length(trim(COALESCE(city, ''))) > 0
      AND length(trim(COALESCE(region, ''))) > 0
    )
  )
);

CREATE INDEX IF NOT EXISTS delivery_requests_status_date_idx
  ON public.delivery_requests (status, preferred_date, created_at);
CREATE INDEX IF NOT EXISTS delivery_requests_customer_idx
  ON public.delivery_requests (customer_user_id, created_at DESC);

ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers read own delivery requests"
  ON public.delivery_requests;
CREATE POLICY "Customers read own delivery requests"
  ON public.delivery_requests
  FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Staff manage delivery requests"
  ON public.delivery_requests;
CREATE POLICY "Staff manage delivery requests"
  ON public.delivery_requests
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

DROP TRIGGER IF EXISTS update_delivery_requests_updated_at
  ON public.delivery_requests;
CREATE TRIGGER update_delivery_requests_updated_at
  BEFORE UPDATE ON public.delivery_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
