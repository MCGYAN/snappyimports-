-- Harden store RLS: close public data leaks while keeping shop + admin working.
-- Sensitive writes stay on service_role API routes (supabaseAdmin).

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin_or_staff()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role)::text IN ('admin', 'staff')
  );
END;
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role)::text = 'admin'
  );
END;
$$;

REVOKE ALL ON FUNCTION private.is_admin_or_staff() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_admin_or_staff() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, anon;

-- ORDERS: remove world-readable guest orders / open inserts
DROP POLICY IF EXISTS "Enable select for guest orders" ON public.orders;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.orders;

DROP POLICY IF EXISTS "Users view own orders" ON public.orders;
CREATE POLICY "Users view own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own unpaid orders" ON public.orders;

DROP POLICY IF EXISTS "Staff manage all orders" ON public.orders;
CREATE POLICY "Staff manage all orders"
  ON public.orders
  FOR ALL
  TO authenticated
  USING (private.is_admin_or_staff())
  WITH CHECK (private.is_admin_or_staff());

-- ORDER ITEMS
DROP POLICY IF EXISTS "Enable select for guest order items" ON public.order_items;
DROP POLICY IF EXISTS "Enable insert for order items" ON public.order_items;

DROP POLICY IF EXISTS "Users view own order items" ON public.order_items;
CREATE POLICY "Users view own order items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff manage order items" ON public.order_items;
CREATE POLICY "Staff manage order items"
  ON public.order_items
  FOR ALL
  TO authenticated
  USING (private.is_admin_or_staff())
  WITH CHECK (private.is_admin_or_staff());

-- EXCHANGE ORDERS: was publicly readable (USING true)
DROP POLICY IF EXISTS "Public read own exchange by number" ON public.exchange_orders;
DROP POLICY IF EXISTS "Public insert exchange orders" ON public.exchange_orders;
DROP POLICY IF EXISTS "Admin manage exchange orders" ON public.exchange_orders;
DROP POLICY IF EXISTS "Users view own exchange orders" ON public.exchange_orders;
DROP POLICY IF EXISTS "Staff manage exchange orders" ON public.exchange_orders;

CREATE POLICY "Users view own exchange orders"
  ON public.exchange_orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff manage exchange orders"
  ON public.exchange_orders
  FOR ALL
  TO authenticated
  USING (private.is_admin_or_staff())
  WITH CHECK (private.is_admin_or_staff());

-- STORE MODULES: anon could UPDATE
DROP POLICY IF EXISTS "Allow authenticated update" ON public.store_modules;
DROP POLICY IF EXISTS "Allow admin insert on store_modules" ON public.store_modules;
DROP POLICY IF EXISTS "Allow public read access" ON public.store_modules;
DROP POLICY IF EXISTS "Staff manage store modules" ON public.store_modules;
DROP POLICY IF EXISTS "Public read store modules" ON public.store_modules;

CREATE POLICY "Public read store modules"
  ON public.store_modules
  FOR SELECT
  USING (true);

CREATE POLICY "Staff manage store modules"
  ON public.store_modules
  FOR ALL
  TO authenticated
  USING (private.is_admin_or_staff())
  WITH CHECK (private.is_admin_or_staff());

-- COUPONS
DROP POLICY IF EXISTS "Allow anon read access to coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow authenticated read access to coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow admin insert on coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow admin update on coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow admin delete on coupons" ON public.coupons;
DROP POLICY IF EXISTS "Staff manage coupons" ON public.coupons;
DROP POLICY IF EXISTS "Public read active coupons" ON public.coupons;

CREATE POLICY "Staff manage coupons"
  ON public.coupons
  FOR ALL
  TO authenticated
  USING (private.is_admin_or_staff())
  WITH CHECK (private.is_admin_or_staff());

CREATE POLICY "Public read active coupons"
  ON public.coupons
  FOR SELECT
  USING (
    COALESCE(is_active, true) = true
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date IS NULL OR end_date > now())
  );

-- STORE SETTINGS
DROP POLICY IF EXISTS "Staff view settings" ON public.store_settings;
DROP POLICY IF EXISTS "Staff manage settings" ON public.store_settings;

CREATE POLICY "Staff manage settings"
  ON public.store_settings
  FOR ALL
  TO authenticated
  USING (private.is_admin_or_staff())
  WITH CHECK (private.is_admin_or_staff());

-- CATEGORIES
DROP POLICY IF EXISTS "Public view categories" ON public.categories;
DROP POLICY IF EXISTS "Public view active categories" ON public.categories;
CREATE POLICY "Public view active categories"
  ON public.categories
  FOR SELECT
  USING (
    (status)::text = 'active'
    OR private.is_admin_or_staff()
  );

-- PRODUCT IMAGES / VARIANTS
DROP POLICY IF EXISTS "Public view images" ON public.product_images;
DROP POLICY IF EXISTS "Public view images for active products" ON public.product_images;
CREATE POLICY "Public view images for active products"
  ON public.product_images
  FOR SELECT
  USING (
    private.is_admin_or_staff()
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.status = 'active'::product_status
    )
  );

DROP POLICY IF EXISTS "Public view variants" ON public.product_variants;
DROP POLICY IF EXISTS "Public view variants for active products" ON public.product_variants;
CREATE POLICY "Public view variants for active products"
  ON public.product_variants
  FOR SELECT
  USING (
    private.is_admin_or_staff()
    OR EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_variants.product_id
        AND p.status = 'active'::product_status
    )
  );

-- PROFILES
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND admin_permissions IS NOT DISTINCT FROM (
      SELECT p.admin_permissions FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff manage profiles" ON public.profiles;
CREATE POLICY "Staff manage profiles"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (private.is_admin_or_staff())
  WITH CHECK (private.is_admin_or_staff());

-- CONTACT
DROP POLICY IF EXISTS "Allow insert for contact form" ON public.contact_submissions;
CREATE POLICY "Allow insert for contact form"
  ON public.contact_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(trim(name)) >= 2
    AND char_length(trim(email)) >= 5
    AND char_length(trim(message)) >= 5
    AND char_length(trim(message)) <= 5000
  );

-- FORCE RLS (service_role still bypasses)
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coupons FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_modules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;
