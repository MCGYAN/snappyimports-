-- Customer Insights across shop, Buy RMB and shipping. Paid activity only.
-- A customer is keyed by account id, or by email when they checked out as a guest.

CREATE OR REPLACE FUNCTION public.customer_insight_activity()
RETURNS TABLE (
  customer_key text,
  uid uuid,
  email text,
  service text,
  paid boolean,
  ghs numeric,
  rmb numeric,
  foreign_paid boolean,
  at timestamptz,
  name text,
  phone text,
  bill_due boolean,
  package_status text,
  ref text,
  entity_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH activity AS (
    SELECT
      o.user_id,
      lower(nullif(btrim(o.email), '')) AS email,
      'shop'::text AS service,
      true AS paid,
      coalesce(o.total, 0)::numeric AS ghs,
      0::numeric AS rmb,
      false AS foreign_paid,
      COALESCE(
        public.analytics_safe_timestamptz(o.metadata->>'payment_confirmed_at'),
        public.analytics_safe_timestamptz(o.metadata->>'payment_verified_at'),
        o.updated_at
      ) AS at,
      nullif(btrim(COALESCE(
        o.shipping_address->>'full_name',
        concat_ws(' ', o.shipping_address->>'firstName', o.shipping_address->>'lastName')
      )), '') AS name,
      COALESCE(nullif(btrim(o.phone), ''), nullif(btrim(o.shipping_address->>'phone'), '')) AS phone,
      false AS bill_due,
      NULL::text AS package_status,
      o.order_number AS ref,
      o.id AS entity_id
    FROM public.orders o
    WHERE o.payment_status::text = 'paid' AND o.status::text <> 'cancelled'

    UNION ALL

    SELECT
      e.user_id,
      lower(nullif(btrim(e.email), '')),
      'rmb',
      true,
      CASE WHEN coalesce(e.currency_from, 'GHS') = 'GHS' THEN coalesce(e.amount_from, 0) ELSE 0 END,
      coalesce(e.amount_to, 0),
      coalesce(e.currency_from, 'GHS') <> 'GHS',
      COALESCE(e.confirmed_at, e.completed_at, e.updated_at),
      nullif(btrim(e.customer_name), ''),
      nullif(btrim(e.phone), ''),
      false,
      NULL,
      e.exchange_number,
      e.id
    FROM public.exchange_orders e
    WHERE e.payment_status = 'paid'

    UNION ALL

    SELECT
      sp.customer_user_id,
      lower(nullif(btrim(sp.customer_email), '')),
      'shipping',
      (sp.shipping_payment_status = 'paid' AND NOT coalesce(sp.freight_included, false)),
      CASE
        WHEN sp.shipping_payment_status = 'paid' AND NOT coalesce(sp.freight_included, false)
          THEN coalesce(sp.final_shipping_ghs, 0)
        ELSE 0
      END,
      0,
      false,
      COALESCE(sp.shipping_paid_at, sp.arrived_at, sp.warehouse_received_at, sp.created_at),
      NULL,
      NULL,
      (
        NOT coalesce(sp.freight_included, false)
        AND coalesce(sp.shipping_payment_status, 'unpaid') <> 'paid'
        AND coalesce(sp.final_shipping_ghs, 0) > 0
      ),
      sp.status,
      sp.tracking_id,
      sp.id
    FROM public.shipping_packages sp
  )
  SELECT
    COALESCE(COALESCE(a.user_id, p.id)::text, 'email:' || a.email) AS customer_key,
    COALESCE(a.user_id, p.id) AS uid,
    a.email,
    a.service,
    a.paid,
    a.ghs,
    a.rmb,
    a.foreign_paid,
    a.at,
    a.name,
    a.phone,
    a.bill_due,
    a.package_status,
    a.ref,
    a.entity_id
  FROM activity a
  LEFT JOIN LATERAL (
    SELECT pr.id
    FROM public.profiles pr
    WHERE a.user_id IS NULL AND a.email IS NOT NULL AND lower(pr.email) = a.email
    LIMIT 1
  ) p ON true
  WHERE a.user_id IS NOT NULL OR a.email IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.customer_insights(
  p_search text DEFAULT NULL,
  p_segment text DEFAULT NULL,
  p_service text DEFAULT NULL,
  p_sort text DEFAULT 'value',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25,
  p_export boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_segment text := nullif(lower(btrim(coalesce(p_segment, ''))), '');
  v_service text := nullif(lower(btrim(coalesce(p_service, ''))), '');
  v_sort text := coalesce(nullif(lower(btrim(p_sort)), ''), 'value');
  v_page integer := GREATEST(1, coalesce(p_page, 1));
  v_page_size integer;
  v_offset integer;
  v_vip numeric := 10000;
  v_result jsonb;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF v_segment = 'all' THEN v_segment := NULL; END IF;
  IF v_service = 'all' THEN v_service := NULL; END IF;

  IF p_export THEN
    v_page_size := 5000;
    v_offset := 0;
  ELSE
    v_page_size := LEAST(100, GREATEST(1, coalesce(p_page_size, 25)));
    v_offset := (v_page - 1) * v_page_size;
  END IF;

  WITH grouped AS (
    SELECT
      a.customer_key,
      (array_agg(a.uid) FILTER (WHERE a.uid IS NOT NULL))[1] AS uid,
      (array_agg(a.email ORDER BY a.at DESC) FILTER (WHERE a.email IS NOT NULL))[1] AS email,
      (array_agg(a.name ORDER BY a.at DESC) FILTER (WHERE a.name IS NOT NULL))[1] AS activity_name,
      (array_agg(a.phone ORDER BY a.at DESC) FILTER (WHERE a.phone IS NOT NULL))[1] AS activity_phone,
      count(*) FILTER (WHERE a.service = 'shop') AS shop_orders,
      coalesce(sum(a.ghs) FILTER (WHERE a.service = 'shop'), 0) AS shop_ghs,
      count(*) FILTER (WHERE a.service = 'rmb') AS rmb_orders,
      coalesce(sum(a.ghs) FILTER (WHERE a.service = 'rmb'), 0) AS rmb_ghs,
      coalesce(sum(a.rmb) FILTER (WHERE a.service = 'rmb'), 0) AS rmb_total,
      bool_or(a.foreign_paid) AS has_foreign_rmb,
      count(*) FILTER (WHERE a.service = 'shipping' AND a.paid) AS shipping_bills_paid,
      coalesce(sum(a.ghs) FILTER (WHERE a.service = 'shipping'), 0) AS shipping_ghs,
      count(*) FILTER (WHERE a.service = 'shipping') AS packages,
      count(*) FILTER (WHERE a.package_status IN ('loaded', 'in_transit')) AS packages_in_transit,
      count(*) FILTER (WHERE a.package_status = 'ready') AS packages_ready,
      bool_or(a.bill_due) AS bill_due,
      bool_or(a.paid) AS paid_any,
      min(a.at) FILTER (WHERE a.paid) AS first_paid_at,
      max(a.at) FILTER (WHERE a.paid) AS last_paid_at,
      coalesce(sum(a.ghs) FILTER (WHERE a.paid), 0) AS total_ghs
    FROM public.customer_insight_activity() a
    GROUP BY a.customer_key
  ),
  customers AS (
    SELECT
      g.*,
      COALESCE(
        nullif(btrim(pr.full_name), ''),
        nullif(btrim(c.full_name), ''),
        nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''),
        g.activity_name,
        nullif(split_part(coalesce(g.email, ''), '@', 1), ''),
        'Customer'
      ) AS name,
      COALESCE(nullif(btrim(pr.phone), ''), nullif(btrim(c.phone), ''), g.activity_phone) AS phone,
      g.uid IS NULL AS is_guest,
      ((g.shop_orders > 0)::int + (g.rmb_orders > 0)::int + (g.shipping_bills_paid > 0)::int) AS services_count,
      (g.shop_orders + g.rmb_orders + g.shipping_bills_paid) AS paid_transactions
    FROM grouped g
    LEFT JOIN public.profiles pr ON pr.id = g.uid
    LEFT JOIN LATERAL (
      SELECT cu.full_name, cu.first_name, cu.last_name, cu.phone
      FROM public.customers cu
      WHERE (g.uid IS NOT NULL AND cu.user_id = g.uid)
         OR (g.email IS NOT NULL AND lower(cu.email) = g.email)
      ORDER BY cu.updated_at DESC NULLS LAST
      LIMIT 1
    ) c ON true
    WHERE g.paid_any
  ),
  flagged AS (
    SELECT
      c.*,
      c.total_ghs >= v_vip AS is_vip,
      c.services_count >= 2 AS is_multi,
      c.services_count = 1 AS is_cross_sell,
      c.last_paid_at < now() - interval '90 days' AS is_at_risk,
      c.first_paid_at >= now() - interval '30 days' AS is_new
    FROM customers c
  ),
  filtered AS (
    SELECT * FROM flagged f
    WHERE (
        v_segment IS NULL
        OR (v_segment = 'vip' AND f.is_vip)
        OR (v_segment = 'multi' AND f.is_multi)
        OR (v_segment = 'cross_sell' AND f.is_cross_sell)
        OR (v_segment = 'at_risk' AND f.is_at_risk)
        OR (v_segment = 'new' AND f.is_new)
        OR (v_segment = 'bill_due' AND f.bill_due)
      )
      AND (
        v_service IS NULL
        OR (v_service = 'shop' AND f.shop_orders > 0)
        OR (v_service = 'rmb' AND f.rmb_orders > 0)
        OR (v_service = 'shipping' AND f.shipping_bills_paid > 0)
      )
      AND (
        v_search IS NULL
        OR lower(f.name) LIKE '%' || v_search || '%'
        OR lower(coalesce(f.email, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(f.phone, '')) LIKE '%' || v_search || '%'
      )
  ),
  summary AS (
    SELECT jsonb_build_object(
      'customers', count(*),
      'total_ghs', round(coalesce(sum(total_ghs), 0)::numeric, 2),
      'avg_ghs', CASE WHEN count(*) > 0 THEN round((sum(total_ghs) / count(*))::numeric, 2) ELSE 0 END,
      'vip', count(*) FILTER (WHERE is_vip),
      'multi', count(*) FILTER (WHERE is_multi),
      'at_risk', count(*) FILTER (WHERE is_at_risk),
      'new', count(*) FILTER (WHERE is_new),
      'bill_due', count(*) FILTER (WHERE bill_due),
      'shop', count(*) FILTER (WHERE shop_orders > 0),
      'rmb', count(*) FILTER (WHERE rmb_orders > 0),
      'shipping', count(*) FILTER (WHERE shipping_bills_paid > 0),
      'vip_threshold', v_vip
    ) AS value
    FROM flagged
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM filtered
  ),
  paged AS (
    SELECT coalesce(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb) AS value
    FROM (
      SELECT
        customer_key AS id,
        name,
        email,
        phone,
        is_guest,
        shop_orders,
        round(shop_ghs::numeric, 2) AS shop_ghs,
        rmb_orders,
        round(rmb_ghs::numeric, 2) AS rmb_ghs,
        round(rmb_total::numeric, 2) AS rmb_total,
        has_foreign_rmb,
        shipping_bills_paid,
        round(shipping_ghs::numeric, 2) AS shipping_ghs,
        packages,
        packages_in_transit,
        packages_ready,
        bill_due,
        first_paid_at,
        last_paid_at,
        round(total_ghs::numeric, 2) AS total_ghs,
        services_count,
        paid_transactions,
        is_vip,
        is_multi,
        is_cross_sell,
        is_at_risk,
        is_new
      FROM filtered
      ORDER BY
        CASE WHEN v_sort = 'recent' THEN extract(epoch FROM last_paid_at) END DESC NULLS LAST,
        CASE WHEN v_sort = 'activity' THEN paid_transactions END DESC NULLS LAST,
        total_ghs DESC,
        last_paid_at DESC NULLS LAST
      LIMIT v_page_size
      OFFSET v_offset
    ) q
  )
  SELECT jsonb_build_object(
    'total', counted.total,
    'page', v_page,
    'page_size', v_page_size,
    'export_capped', p_export AND counted.total > 5000,
    'summary', summary.value,
    'rows', paged.value
  )
  INTO v_result
  FROM counted, summary, paged;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_insight_timeline(p_customer_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.at DESC NULLS LAST), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT service, paid, ghs, rmb, foreign_paid, at, bill_due, package_status, ref, entity_id
    FROM public.customer_insight_activity()
    WHERE customer_key = p_customer_key
    ORDER BY at DESC NULLS LAST
    LIMIT 100
  ) t;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.customer_insight_activity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.customer_insights(text, text, text, text, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.customer_insight_timeline(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_insight_activity() TO service_role;
GRANT EXECUTE ON FUNCTION public.customer_insights(text, text, text, text, integer, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.customer_insight_timeline(text) TO service_role;
