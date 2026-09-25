-- Paid shop orders and paid Buy RMB orders for the analytics section.
-- Both are date-bounded and paginated so each request only reads a slice.

CREATE OR REPLACE FUNCTION public.analytics_safe_timestamptz(p_value text)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF p_value IS NULL OR p_value !~ '^\d{4}-\d{2}-\d{2}' THEN
    RETURN NULL;
  END IF;
  RETURN p_value::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE INDEX IF NOT EXISTS orders_paid_created_idx
  ON public.orders (payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS exchange_orders_paid_confirmed_idx
  ON public.exchange_orders (payment_status, confirmed_at DESC);

CREATE OR REPLACE FUNCTION public.shop_orders_analytics(
  p_from timestamptz,
  p_to timestamptz,
  p_search text DEFAULT NULL,
  p_stage text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_export boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_stage text := nullif(lower(btrim(coalesce(p_stage, ''))), '');
  v_page integer := GREATEST(1, coalesce(p_page, 1));
  v_page_size integer;
  v_offset integer;
  v_result jsonb;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'A valid date range is required.';
  END IF;
  IF p_to > p_from + interval '3 months 1 day' THEN
    RAISE EXCEPTION 'Date range cannot exceed 3 months.';
  END IF;
  IF v_stage = 'all' THEN v_stage := NULL; END IF;

  IF p_export THEN
    v_page_size := 5000;
    v_offset := 0;
  ELSE
    v_page_size := LEAST(100, GREATEST(1, coalesce(p_page_size, 50)));
    v_offset := (v_page - 1) * v_page_size;
  END IF;

  WITH ranged AS (
    SELECT * FROM (
      SELECT
        o.*,
        COALESCE(
          public.analytics_safe_timestamptz(o.metadata->>'payment_confirmed_at'),
          public.analytics_safe_timestamptz(o.metadata->>'payment_verified_at'),
          o.updated_at
        ) AS paid_at
      FROM public.orders o
      WHERE o.payment_status::text = 'paid'
        AND o.status::text <> 'cancelled'
        AND o.created_at <= p_to
    ) paid_orders
    WHERE paid_orders.paid_at >= p_from AND paid_orders.paid_at <= p_to
  ),
  enriched AS (
    SELECT
      r.id,
      r.order_number,
      r.email,
      COALESCE(nullif(btrim(r.phone), ''), nullif(btrim(r.shipping_address->>'phone'), '')) AS phone,
      COALESCE(
        nullif(btrim(r.shipping_address->>'full_name'), ''),
        nullif(btrim(concat_ws(' ', r.shipping_address->>'firstName', r.shipping_address->>'lastName')), ''),
        nullif(btrim(concat_ws(' ', r.metadata->>'first_name', r.metadata->>'last_name')), ''),
        nullif(split_part(coalesce(r.email, ''), '@', 1), ''),
        'Customer'
      ) AS customer_name,
      r.total,
      r.currency,
      COALESCE(nullif(r.payment_method, ''), r.metadata->>'payment_channel', 'Payment') AS payment_method,
      r.metadata->>'fulfillment_stage' AS fulfillment_stage,
      r.created_at,
      r.paid_at,
      items.items_summary,
      items.item_count,
      pk.packaged_at,
      pk.package_tracking
    FROM ranged r
    LEFT JOIN LATERAL (
      SELECT
        string_agg(
          oi.product_name
            || CASE WHEN nullif(oi.variant_name, '') IS NOT NULL THEN ' (' || oi.variant_name || ')' ELSE '' END
            || ' x' || oi.quantity,
          '; ' ORDER BY oi.created_at
        ) AS items_summary,
        coalesce(sum(oi.quantity), 0)::int AS item_count
      FROM public.order_items oi
      WHERE oi.order_id = r.id
    ) items ON true
    LEFT JOIN LATERAL (
      SELECT
        min(spi.created_at) AS packaged_at,
        string_agg(DISTINCT sp.tracking_id, ', ') AS package_tracking
      FROM public.order_items oi
      JOIN public.shipping_package_items spi ON spi.order_item_id = oi.id
      JOIN public.shipping_packages sp ON sp.id = spi.package_id
      WHERE oi.order_id = r.id
    ) pk ON true
  ),
  filtered AS (
    SELECT * FROM enriched e
    WHERE (
        v_stage IS NULL
        OR (v_stage = 'packaged' AND e.packaged_at IS NOT NULL)
        OR (v_stage = 'awaiting_packaging' AND e.packaged_at IS NULL)
      )
      AND (
        v_search IS NULL
        OR lower(coalesce(e.order_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(e.email, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(e.phone, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(e.customer_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(e.items_summary, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(e.package_tracking, '')) LIKE '%' || v_search || '%'
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM filtered
  ),
  summary AS (
    SELECT jsonb_build_object(
      'orders', count(*),
      'revenue', round(coalesce(sum(total), 0)::numeric, 2),
      'aov', CASE WHEN count(*) > 0 THEN round((sum(total) / count(*))::numeric, 2) ELSE 0 END,
      'items', coalesce(sum(item_count), 0),
      'packaged', count(*) FILTER (WHERE packaged_at IS NOT NULL),
      'awaiting_packaging', count(*) FILTER (WHERE packaged_at IS NULL)
    ) AS value
    FROM filtered
  ),
  daily AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'revenue', d.revenue, 'orders', d.orders) ORDER BY d.day), '[]'::jsonb) AS value
    FROM (
      SELECT
        gs::date AS day,
        round(coalesce(sum(f.total), 0)::numeric, 2) AS revenue,
        count(f.id) AS orders
      FROM generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day') gs
      LEFT JOIN filtered f ON date_trunc('day', f.paid_at) = gs
      GROUP BY gs
    ) d
  ),
  top_products AS (
    SELECT coalesce(jsonb_agg(t ORDER BY t.revenue DESC), '[]'::jsonb) AS value
    FROM (
      SELECT
        oi.product_name AS name,
        coalesce(sum(oi.quantity), 0)::int AS units,
        round(coalesce(sum(coalesce(oi.total_price, oi.unit_price * oi.quantity)), 0)::numeric, 2) AS revenue
      FROM public.order_items oi
      JOIN filtered f ON f.id = oi.order_id
      GROUP BY oi.product_name
      ORDER BY revenue DESC
      LIMIT 5
    ) t
  ),
  paged AS (
    SELECT coalesce(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb) AS value
    FROM (
      SELECT *
      FROM filtered
      ORDER BY paid_at DESC NULLS LAST, created_at DESC
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
    'daily', daily.value,
    'top_products', top_products.value,
    'rows', paged.value
  )
  INTO v_result
  FROM counted, summary, daily, top_products, paged;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rmb_orders_analytics(
  p_from timestamptz,
  p_to timestamptz,
  p_search text DEFAULT NULL,
  p_stage text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_export boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_stage text := nullif(lower(btrim(coalesce(p_stage, ''))), '');
  v_page integer := GREATEST(1, coalesce(p_page, 1));
  v_page_size integer;
  v_offset integer;
  v_result jsonb;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'A valid date range is required.';
  END IF;
  IF p_to > p_from + interval '3 months 1 day' THEN
    RAISE EXCEPTION 'Date range cannot exceed 3 months.';
  END IF;
  IF v_stage = 'all' THEN v_stage := NULL; END IF;

  IF p_export THEN
    v_page_size := 5000;
    v_offset := 0;
  ELSE
    v_page_size := LEAST(100, GREATEST(1, coalesce(p_page_size, 50)));
    v_offset := (v_page - 1) * v_page_size;
  END IF;

  WITH filtered AS (
    SELECT
      e.id,
      e.exchange_number,
      COALESCE(nullif(btrim(e.customer_name), ''), nullif(split_part(coalesce(e.email, ''), '@', 1), ''), 'Customer') AS customer_name,
      e.business_name,
      e.email,
      e.phone,
      e.country_code,
      e.rate,
      e.amount_from,
      e.currency_from,
      e.amount_to,
      e.currency_to,
      e.status,
      e.created_at,
      e.payment_sent_at,
      COALESCE(e.confirmed_at, e.completed_at, e.updated_at) AS paid_at,
      e.completed_at
    FROM public.exchange_orders e
    WHERE e.payment_status = 'paid'
      AND COALESCE(e.confirmed_at, e.completed_at, e.updated_at) >= p_from
      AND COALESCE(e.confirmed_at, e.completed_at, e.updated_at) <= p_to
      AND (v_stage IS NULL OR lower(e.status) = v_stage)
      AND (
        v_search IS NULL
        OR lower(coalesce(e.exchange_number, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(e.customer_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(e.business_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(e.email, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(e.phone, '')) LIKE '%' || v_search || '%'
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM filtered
  ),
  summary AS (
    SELECT jsonb_build_object(
      'orders', count(*),
      'completed', count(*) FILTER (WHERE status = 'completed'),
      'awaiting_delivery', count(*) FILTER (WHERE status <> 'completed'),
      'rmb_total', round(coalesce(sum(amount_to), 0)::numeric, 2),
      'customers', count(DISTINCT lower(coalesce(nullif(email, ''), phone, customer_name)))
    ) AS value
    FROM filtered
  ),
  by_currency AS (
    SELECT coalesce(jsonb_agg(c ORDER BY c.amount_from DESC), '[]'::jsonb) AS value
    FROM (
      SELECT
        coalesce(currency_from, 'GHS') AS currency,
        count(*) AS orders,
        round(sum(amount_from)::numeric, 2) AS amount_from,
        round(sum(amount_to)::numeric, 2) AS amount_to
      FROM filtered
      GROUP BY coalesce(currency_from, 'GHS')
    ) c
  ),
  daily AS (
    SELECT coalesce(jsonb_agg(jsonb_build_object('date', d.day, 'rmb', d.rmb, 'orders', d.orders) ORDER BY d.day), '[]'::jsonb) AS value
    FROM (
      SELECT
        gs::date AS day,
        round(coalesce(sum(f.amount_to), 0)::numeric, 2) AS rmb,
        count(f.id) AS orders
      FROM generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day') gs
      LEFT JOIN filtered f ON date_trunc('day', f.paid_at) = gs
      GROUP BY gs
    ) d
  ),
  paged AS (
    SELECT coalesce(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb) AS value
    FROM (
      SELECT *
      FROM filtered
      ORDER BY paid_at DESC NULLS LAST, created_at DESC
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
    'by_currency', by_currency.value,
    'daily', daily.value,
    'rows', paged.value
  )
  INTO v_result
  FROM counted, summary, by_currency, daily, paged;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.shop_orders_analytics(timestamptz, timestamptz, text, text, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rmb_orders_analytics(timestamptz, timestamptz, text, text, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_orders_analytics(timestamptz, timestamptz, text, text, integer, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.rmb_orders_analytics(timestamptz, timestamptz, text, text, integer, integer, boolean) TO service_role;
