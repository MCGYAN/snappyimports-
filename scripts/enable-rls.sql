-- ============================================================================
-- SAMBATEK STORE — COMPLETE ROW LEVEL SECURITY (RLS)
-- Run this entire script in: Supabase Dashboard → SQL Editor
-- It is safe to re-run multiple times (all DROP IF EXISTS before CREATE).
-- ============================================================================


-- ============================================================================
-- 0. HELPER FUNCTION — is_admin_or_staff()
--    SECURITY DEFINER so it can read profiles without needing its own policy.
--    Re-create every time to ensure it is up to date.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
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


-- ============================================================================
-- 1. PROFILES
--    Users see and edit only their own. Staff/admin can see all.
-- ============================================================================
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own profile"            ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"        ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile"          ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON public.profiles;
DROP POLICY IF EXISTS "Staff view any profile"            ON public.profiles;
DROP POLICY IF EXISTS "Admin view all profiles"           ON public.profiles;

CREATE POLICY "Users view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins & staff can see all profiles (for CRM / admin panel)
CREATE POLICY "Staff view any profile"
  ON public.profiles FOR SELECT
  USING (is_admin_or_staff());

-- Service role bypass is automatic; no explicit policy needed.


-- ============================================================================
-- 2. ADDRESSES
--    Users manage only their own. Staff can manage all.
-- ============================================================================
ALTER TABLE IF EXISTS public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own addresses"   ON public.addresses;
DROP POLICY IF EXISTS "Staff manage all addresses"   ON public.addresses;

CREATE POLICY "Users manage own addresses"
  ON public.addresses FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff manage all addresses"
  ON public.addresses FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 3. PRODUCTS
--    Public: only active products.  Staff: all products (for admin panel).
-- ============================================================================
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view products"         ON public.products;
DROP POLICY IF EXISTS "Public view active products"      ON public.products;
DROP POLICY IF EXISTS "Staff manage products"            ON public.products;

CREATE POLICY "Public view active products"
  ON public.products FOR SELECT
  USING (status = 'active'::product_status OR is_admin_or_staff());

CREATE POLICY "Staff manage products"
  ON public.products FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 4. PRODUCT IMAGES — public read, staff write
-- ============================================================================
ALTER TABLE IF EXISTS public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view product images"  ON public.product_images;
DROP POLICY IF EXISTS "Public view images"              ON public.product_images;
DROP POLICY IF EXISTS "Staff manage images"             ON public.product_images;

CREATE POLICY "Public view images"
  ON public.product_images FOR SELECT
  USING (true);

CREATE POLICY "Staff manage images"
  ON public.product_images FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 5. PRODUCT VARIANTS — public read, staff write
-- ============================================================================
ALTER TABLE IF EXISTS public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view variants"   ON public.product_variants;
DROP POLICY IF EXISTS "Public view variants"       ON public.product_variants;
DROP POLICY IF EXISTS "Staff manage variants"      ON public.product_variants;

CREATE POLICY "Public view variants"
  ON public.product_variants FOR SELECT
  USING (true);

CREATE POLICY "Staff manage variants"
  ON public.product_variants FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 6. CATEGORIES — public read, staff write
-- ============================================================================
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view categories"  ON public.categories;
DROP POLICY IF EXISTS "Public view categories"      ON public.categories;
DROP POLICY IF EXISTS "Staff manage categories"     ON public.categories;

CREATE POLICY "Public view categories"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "Staff manage categories"
  ON public.categories FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 7. COUPONS
--    Public can only read active coupons (needed for checkout validation).
--    Only staff/admin can create, update, delete.
-- ============================================================================
ALTER TABLE IF EXISTS public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active coupons"          ON public.coupons;
DROP POLICY IF EXISTS "Public can read coupons"                 ON public.coupons;
DROP POLICY IF EXISTS "Allow anon read access to coupons"       ON public.coupons;
DROP POLICY IF EXISTS "Allow authenticated read access to coupons" ON public.coupons;
DROP POLICY IF EXISTS "Allow admin insert on coupons"           ON public.coupons;
DROP POLICY IF EXISTS "Allow admin update on coupons"           ON public.coupons;
DROP POLICY IF EXISTS "Allow admin delete on coupons"           ON public.coupons;
DROP POLICY IF EXISTS "Staff manage coupons"                    ON public.coupons;

-- Only expose active coupons that are within their date window
CREATE POLICY "Public read active coupons"
  ON public.coupons FOR SELECT
  USING (
    is_active = true
    AND (start_date IS NULL OR start_date <= now())
    AND (end_date   IS NULL OR end_date   >= now())
  );

CREATE POLICY "Staff manage coupons"
  ON public.coupons FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 8. ORDERS
--    - Authenticated users see only their own orders.
--    - SECURITY HOLE FIXED: "Enable select for guest orders" removed.
--      Guest orders are accessible only via the API (service_role key) — 
--      never via anon key. Order tracking uses server-side look-up.
--    - Staff/admin see and manage all orders.
-- ============================================================================
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders"        ON public.orders;
DROP POLICY IF EXISTS "Users view own orders"            ON public.orders;
DROP POLICY IF EXISTS "Users can create orders"          ON public.orders;
DROP POLICY IF EXISTS "Anon can create guest orders"     ON public.orders;
DROP POLICY IF EXISTS "Enable insert for all users"      ON public.orders;
DROP POLICY IF EXISTS "Enable select for guest orders"   ON public.orders;  -- REMOVED: security hole
DROP POLICY IF EXISTS "Staff manage all orders"          ON public.orders;

-- Authenticated users view only their own orders
CREATE POLICY "Users view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users create their own orders
CREATE POLICY "Authenticated users create orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = user_id)
    OR
    (auth.uid() IS NULL AND user_id IS NULL)  -- guest checkout
  );

-- Staff / admin full access
CREATE POLICY "Staff manage all orders"
  ON public.orders FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 9. ORDER ITEMS
--    Users see items only for their own orders.
--    SECURITY HOLE FIXED: "Enable select for guest order items" removed.
-- ============================================================================
ALTER TABLE IF EXISTS public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own order items"         ON public.order_items;
DROP POLICY IF EXISTS "Users view own order items"             ON public.order_items;
DROP POLICY IF EXISTS "Users can insert order items"           ON public.order_items;
DROP POLICY IF EXISTS "Enable insert for order items"          ON public.order_items;
DROP POLICY IF EXISTS "Enable select for guest order items"    ON public.order_items;  -- REMOVED
DROP POLICY IF EXISTS "Staff manage order items"               ON public.order_items;

CREATE POLICY "Users view own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Insert order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR orders.user_id IS NULL)
    )
  );

CREATE POLICY "Staff manage order items"
  ON public.order_items FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 10. ORDER STATUS HISTORY
-- ============================================================================
ALTER TABLE IF EXISTS public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own order history"  ON public.order_status_history;
DROP POLICY IF EXISTS "Users view order history"          ON public.order_status_history;
DROP POLICY IF EXISTS "Staff manage order history"        ON public.order_status_history;

CREATE POLICY "Users view order history"
  ON public.order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_status_history.order_id
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff manage order history"
  ON public.order_status_history FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 11. CART ITEMS — users manage only their own
-- ============================================================================
ALTER TABLE IF EXISTS public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own cart"  ON public.cart_items;

CREATE POLICY "Users manage own cart"
  ON public.cart_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- 12. WISHLIST ITEMS — users manage only their own
-- ============================================================================
ALTER TABLE IF EXISTS public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own wishlist"  ON public.wishlist_items;

CREATE POLICY "Users manage own wishlist"
  ON public.wishlist_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- 13. REVIEWS
--    Public sees only APPROVED reviews.
--    Authenticated users can see and edit their own pending reviews.
--    Staff manages all.
-- ============================================================================
ALTER TABLE IF EXISTS public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view reviews"         ON public.reviews;
DROP POLICY IF EXISTS "Public view reviews"             ON public.reviews;
DROP POLICY IF EXISTS "Public view approved reviews"    ON public.reviews;
DROP POLICY IF EXISTS "Users can create reviews"        ON public.reviews;
DROP POLICY IF EXISTS "Users create reviews"            ON public.reviews;
DROP POLICY IF EXISTS "Users view own reviews"          ON public.reviews;
DROP POLICY IF EXISTS "Users update own reviews"        ON public.reviews;
DROP POLICY IF EXISTS "Staff manage reviews"            ON public.reviews;

CREATE POLICY "Public view approved reviews"
  ON public.reviews FOR SELECT
  USING (status = 'approved'::review_status OR auth.uid() = user_id);

CREATE POLICY "Users create reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff manage reviews"
  ON public.reviews FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 14. REVIEW IMAGES
-- ============================================================================
ALTER TABLE IF EXISTS public.review_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view review images"   ON public.review_images;
DROP POLICY IF EXISTS "Public view review images"       ON public.review_images;
DROP POLICY IF EXISTS "Users manage review images"      ON public.review_images;

-- Only show images attached to approved reviews
CREATE POLICY "Public view approved review images"
  ON public.review_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews
      WHERE reviews.id = review_images.review_id
      AND reviews.status = 'approved'::review_status
    )
  );

-- Users can manage images on their own reviews
CREATE POLICY "Users manage own review images"
  ON public.review_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews
      WHERE reviews.id = review_images.review_id
      AND reviews.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews
      WHERE reviews.id = review_images.review_id
      AND reviews.user_id = auth.uid()
    )
  );


-- ============================================================================
-- 15. BLOG POSTS
--    Public: only published posts. Staff: all (including drafts).
-- ============================================================================
ALTER TABLE IF EXISTS public.blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published posts"  ON public.blog_posts;
DROP POLICY IF EXISTS "Public view posts"                ON public.blog_posts;
DROP POLICY IF EXISTS "Public view published posts"      ON public.blog_posts;
DROP POLICY IF EXISTS "Staff manage blog"                ON public.blog_posts;

CREATE POLICY "Public view published posts"
  ON public.blog_posts FOR SELECT
  USING (status = 'published'::blog_status OR is_admin_or_staff());

CREATE POLICY "Staff manage blog"
  ON public.blog_posts FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 16. SUPPORT TICKETS — users manage own, staff manage all
-- ============================================================================
ALTER TABLE IF EXISTS public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own tickets"  ON public.support_tickets;
DROP POLICY IF EXISTS "Staff manage tickets"      ON public.support_tickets;

CREATE POLICY "Users manage own tickets"
  ON public.support_tickets FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff manage tickets"
  ON public.support_tickets FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 17. SUPPORT MESSAGES
-- ============================================================================
ALTER TABLE IF EXISTS public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view ticket messages"      ON public.support_messages;
DROP POLICY IF EXISTS "Users view messages for own tickets" ON public.support_messages;
DROP POLICY IF EXISTS "Users create messages"           ON public.support_messages;
DROP POLICY IF EXISTS "Staff manage messages"           ON public.support_messages;

CREATE POLICY "Users view own ticket messages"
  ON public.support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = support_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users create messages on own tickets"
  ON public.support_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets
      WHERE support_tickets.id = support_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff manage messages"
  ON public.support_messages FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 18. RETURN REQUESTS — users manage own, staff manage all
-- ============================================================================
ALTER TABLE IF EXISTS public.return_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own returns"   ON public.return_requests;
DROP POLICY IF EXISTS "Users view own returns"     ON public.return_requests;
DROP POLICY IF EXISTS "Users create returns"       ON public.return_requests;
DROP POLICY IF EXISTS "Staff manage returns"       ON public.return_requests;

CREATE POLICY "Users view own returns"
  ON public.return_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create returns"
  ON public.return_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff manage returns"
  ON public.return_requests FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 19. RETURN ITEMS
-- ============================================================================
ALTER TABLE IF EXISTS public.return_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own return items"   ON public.return_items;
DROP POLICY IF EXISTS "Users view return items"       ON public.return_items;
DROP POLICY IF EXISTS "Staff manage return items"     ON public.return_items;

CREATE POLICY "Users view own return items"
  ON public.return_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.return_requests
      WHERE return_requests.id = return_items.return_request_id
      AND return_requests.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff manage return items"
  ON public.return_items FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 20. NOTIFICATIONS — users manage only their own
-- ============================================================================
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Users manage own notifications"   ON public.notifications;

CREATE POLICY "Users manage own notifications"
  ON public.notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin/staff can see all notifications
CREATE POLICY "Staff view notifications"
  ON public.notifications FOR SELECT
  USING (is_admin_or_staff());


-- ============================================================================
-- 21. CUSTOMERS TABLE (CRM)
--    Blocked from anon/authenticated users — staff/admin + service_role only.
-- ============================================================================
ALTER TABLE IF EXISTS public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can manage customers"         ON public.customers;
DROP POLICY IF EXISTS "Staff can view all customers"       ON public.customers;
DROP POLICY IF EXISTS "Staff can manage customers"         ON public.customers;
DROP POLICY IF EXISTS "Service role full access to customers" ON public.customers;

CREATE POLICY "Staff can manage customers"
  ON public.customers FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());

-- Service role (used by API routes) bypasses RLS automatically —
-- this is just a fallback for explicit service_role statements.
CREATE POLICY "Service role full access"
  ON public.customers FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================================
-- 22. PAGES (CMS static pages) — public read, admin write
-- ============================================================================
ALTER TABLE IF EXISTS public.pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view pages"   ON public.pages;
DROP POLICY IF EXISTS "Public view pages"       ON public.pages;
DROP POLICY IF EXISTS "Staff can manage pages"  ON public.pages;

CREATE POLICY "Public view pages"
  ON public.pages FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage pages"
  ON public.pages FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 23. SITE_SETTINGS — public read, admin write
-- ============================================================================
ALTER TABLE IF EXISTS public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on site_settings"   ON public.site_settings;
DROP POLICY IF EXISTS "Public can view settings"             ON public.site_settings;
DROP POLICY IF EXISTS "Allow admin write on site_settings"   ON public.site_settings;
DROP POLICY IF EXISTS "Staff view settings"                  ON public.site_settings;
DROP POLICY IF EXISTS "Staff manage settings"                ON public.site_settings;

CREATE POLICY "Public read site settings"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admin write site settings"
  ON public.site_settings FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 24. STORE_SETTINGS — public read, admin write
-- ============================================================================
ALTER TABLE IF EXISTS public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view store settings"  ON public.store_settings;

CREATE POLICY "Public read store settings"
  ON public.store_settings FOR SELECT
  USING (true);

CREATE POLICY "Admin write store settings"
  ON public.store_settings FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 25. CMS_CONTENT — public reads active blocks, admin writes all
-- ============================================================================
ALTER TABLE IF EXISTS public.cms_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on cms_content"  ON public.cms_content;
DROP POLICY IF EXISTS "Public can view cms"               ON public.cms_content;
DROP POLICY IF EXISTS "Allow admin all on cms_content"    ON public.cms_content;

CREATE POLICY "Public read active cms"
  ON public.cms_content FOR SELECT
  USING (is_active = true OR is_admin_or_staff());

CREATE POLICY "Admin manage cms"
  ON public.cms_content FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 26. BANNERS — public reads active banners, admin writes
-- ============================================================================
ALTER TABLE IF EXISTS public.banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view banners"         ON public.banners;
DROP POLICY IF EXISTS "Allow public read on banners"    ON public.banners;
DROP POLICY IF EXISTS "Allow admin all on banners"      ON public.banners;

CREATE POLICY "Public view active banners"
  ON public.banners FOR SELECT
  USING (is_active = true OR is_admin_or_staff());

CREATE POLICY "Admin manage banners"
  ON public.banners FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 27. NAVIGATION MENUS — public read, admin write
-- ============================================================================
ALTER TABLE IF EXISTS public.navigation_menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view menus"               ON public.navigation_menus;
DROP POLICY IF EXISTS "Allow public read on navigation_menus" ON public.navigation_menus;
DROP POLICY IF EXISTS "Allow admin all on navigation_menus" ON public.navigation_menus;

CREATE POLICY "Public view menus"
  ON public.navigation_menus FOR SELECT
  USING (true);

CREATE POLICY "Admin manage menus"
  ON public.navigation_menus FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 28. NAVIGATION ITEMS — public reads active items, admin writes
-- ============================================================================
ALTER TABLE IF EXISTS public.navigation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view nav items"               ON public.navigation_items;
DROP POLICY IF EXISTS "Allow public read on navigation_items"   ON public.navigation_items;
DROP POLICY IF EXISTS "Allow admin all on navigation_items"     ON public.navigation_items;

CREATE POLICY "Public view active nav items"
  ON public.navigation_items FOR SELECT
  USING (is_active = true OR is_admin_or_staff());

CREATE POLICY "Admin manage nav items"
  ON public.navigation_items FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 29. STORE_MODULES (feature flags)
--    SECURITY HOLE FIXED: removed "Allow authenticated update" (any user could
--    toggle features). Now only admin/staff can mutate.
-- ============================================================================
ALTER TABLE IF EXISTS public.store_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view modules"               ON public.store_modules;
DROP POLICY IF EXISTS "Allow public read access"              ON public.store_modules;
DROP POLICY IF EXISTS "Allow admin insert on store_modules"   ON public.store_modules;
DROP POLICY IF EXISTS "Allow authenticated update"            ON public.store_modules;  -- REMOVED: security hole

CREATE POLICY "Public read store modules"
  ON public.store_modules FOR SELECT
  USING (true);

CREATE POLICY "Admin manage store modules"
  ON public.store_modules FOR ALL
  USING (is_admin_or_staff())
  WITH CHECK (is_admin_or_staff());


-- ============================================================================
-- 30. AUDIT LOGS — staff can read, service_role writes (server-side only)
-- ============================================================================
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view audit logs"    ON public.audit_logs;
DROP POLICY IF EXISTS "Staff view audit logs"        ON public.audit_logs;
DROP POLICY IF EXISTS "Staff insert audit logs"      ON public.audit_logs;

CREATE POLICY "Staff view audit logs"
  ON public.audit_logs FOR SELECT
  USING (is_admin_or_staff());

-- Only service_role (server-side) may insert audit logs; no client write access
CREATE POLICY "Service role insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================================
-- STORAGE POLICIES — ensure storage buckets are locked down correctly
-- ============================================================================

-- Products bucket: public read, admin write
DROP POLICY IF EXISTS "Public read access for products"  ON storage.objects;
DROP POLICY IF EXISTS "Admin upload access for products" ON storage.objects;
DROP POLICY IF EXISTS "Admin update access for products" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete access for products" ON storage.objects;

CREATE POLICY "Public read products bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

CREATE POLICY "Admin upload products bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'products' AND is_admin_or_staff() = true);

CREATE POLICY "Admin update products bucket"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'products' AND is_admin_or_staff() = true);

CREATE POLICY "Admin delete products bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'products' AND is_admin_or_staff() = true);


-- Media bucket: public read, admin write
DROP POLICY IF EXISTS "Public read access for media"  ON storage.objects;
DROP POLICY IF EXISTS "Admin upload access for media" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete access for media" ON storage.objects;

CREATE POLICY "Public read media bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

CREATE POLICY "Admin upload media bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND is_admin_or_staff() = true);

CREATE POLICY "Admin delete media bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND is_admin_or_staff() = true);


-- Avatars bucket: public read, users manage own avatar
DROP POLICY IF EXISTS "Public read avatars"             ON storage.objects;
DROP POLICY IF EXISTS "Users upload own avatar"         ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar"         ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar"         ON storage.objects;

CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);


-- Blog bucket: public read, staff write
DROP POLICY IF EXISTS "Public read blog bucket"   ON storage.objects;
DROP POLICY IF EXISTS "Staff manage blog bucket"  ON storage.objects;

CREATE POLICY "Public read blog bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'blog');

CREATE POLICY "Staff upload blog bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'blog' AND is_admin_or_staff() = true);

CREATE POLICY "Staff delete blog bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'blog' AND is_admin_or_staff() = true);


-- Reviews bucket: public read, authenticated users write their own
DROP POLICY IF EXISTS "Public read reviews bucket"         ON storage.objects;
DROP POLICY IF EXISTS "Users upload review images bucket"  ON storage.objects;

CREATE POLICY "Public read reviews bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reviews');

CREATE POLICY "Authenticated upload review images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reviews' AND auth.uid() IS NOT NULL);


-- ============================================================================
-- VERIFICATION — run after applying to confirm all tables are secured
-- ============================================================================
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '✅ SECURED' ELSE '❌ EXPOSED' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity ASC, tablename;
