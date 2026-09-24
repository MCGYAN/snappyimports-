-- Shipping analytics: date-range queries stay cheap as package volume grows.

CREATE INDEX IF NOT EXISTS shipping_packages_received_at_idx
  ON public.shipping_packages (warehouse_received_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS shipping_packages_carrier_reference_idx
  ON public.shipping_packages (lower(carrier_reference));

CREATE INDEX IF NOT EXISTS shipping_packages_package_name_idx
  ON public.shipping_packages (lower(package_name));

CREATE OR REPLACE FUNCTION public.shipping_packages_analytics(
  p_from timestamptz,
  p_to timestamptz,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
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
  v_from timestamptz;
  v_to timestamptz;
  v_search text;
  v_status text;
  v_page integer;
  v_page_size integer;
  v_offset integer;
  v_limit integer;
  v_result jsonb;
  v_is_staff boolean := EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role)::text IN ('admin', 'staff')
  );
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR v_is_staff
    OR current_user IN ('postgres', 'supabase_admin')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_from IS NULL OR p_to IS NULL THEN
    RAISE EXCEPTION 'Date range is required.';
  END IF;

  v_from := p_from;
  v_to := p_to;
  IF v_to < v_from THEN
    RAISE EXCEPTION 'End date must be on or after the start date.';
  END IF;
  IF v_to > v_from + interval '10 months' THEN
    RAISE EXCEPTION 'Date range cannot exceed 10 months.';
  END IF;

  v_search := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_status := nullif(lower(btrim(coalesce(p_status, ''))), '');
  IF v_status = 'all' THEN
    v_status := NULL;
  END IF;

  v_page := GREATEST(1, coalesce(p_page, 1));
  IF p_export THEN
    v_page_size := 5000;
    v_offset := 0;
  ELSE
    v_page_size := LEAST(100, GREATEST(1, coalesce(p_page_size, 50)));
    v_offset := (v_page - 1) * v_page_size;
  END IF;
  v_limit := v_page_size;

  WITH filtered AS (
    SELECT
      sp.id,
      sp.tracking_id,
      sp.carrier_reference,
      sp.package_name,
      sp.goods_class,
      sp.cbm,
      sp.status,
      sp.shipping_payment_status,
      sp.estimated_shipping_usd,
      sp.estimated_shipping_ghs,
      sp.final_shipping_ghs,
      sp.freight_included,
      sp.customer_email,
      sp.customer_user_id,
      sp.warehouse_received_at,
      sp.loaded_at,
      sp.estimated_arrival_at,
      sp.arrived_at,
      sp.shipping_paid_at,
      sp.created_at,
      COALESCE(sp.warehouse_received_at, sp.created_at) AS effective_received_at,
      COALESCE(
        nullif(btrim(cust.full_name), ''),
        nullif(btrim(concat_ws(' ', cust.first_name, cust.last_name)), ''),
        nullif(btrim(prof.full_name), ''),
        nullif(split_part(coalesce(sp.customer_email, ''), '@', 1), ''),
        'Customer'
      ) AS customer_name
    FROM public.shipping_packages sp
    LEFT JOIN LATERAL (
      SELECT full_name, first_name, last_name
      FROM public.customers c
      WHERE (
        (sp.customer_user_id IS NOT NULL AND c.user_id = sp.customer_user_id)
        OR (
          sp.customer_email IS NOT NULL
          AND lower(c.email) = lower(sp.customer_email)
        )
      )
      ORDER BY c.updated_at DESC NULLS LAST
      LIMIT 1
    ) cust ON true
    LEFT JOIN public.profiles prof
      ON sp.customer_user_id IS NOT NULL AND prof.id = sp.customer_user_id
    WHERE COALESCE(sp.warehouse_received_at, sp.created_at) >= v_from
      AND COALESCE(sp.warehouse_received_at, sp.created_at) <= v_to
      AND (v_status IS NULL OR lower(sp.status) = v_status)
      AND (
        v_search IS NULL
        OR lower(coalesce(sp.tracking_id, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(sp.carrier_reference, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(sp.package_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(sp.customer_email, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(cust.full_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(cust.first_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(cust.last_name, '')) LIKE '%' || v_search || '%'
        OR lower(coalesce(prof.full_name, '')) LIKE '%' || v_search || '%'
      )
  ),
  counted AS (
    SELECT count(*)::bigint AS total FROM filtered
  ),
  summary AS (
    SELECT jsonb_build_object(
      'packages', count(*),
      'received', count(*) FILTER (WHERE status = 'received'),
      'in_transit', count(*) FILTER (WHERE status IN ('loaded', 'in_transit')),
      'arrived', count(*) FILTER (WHERE status IN ('arrived', 'clearing')),
      'ready', count(*) FILTER (WHERE status IN ('ready', 'delivered')),
      'paid', count(*) FILTER (
        WHERE shipping_payment_status = 'paid' OR freight_included IS TRUE
      ),
      'cbm_total', round(coalesce(sum(cbm), 0)::numeric, 3),
      'freight_usd', round(coalesce(sum(estimated_shipping_usd), 0)::numeric, 2),
      'freight_ghs', round(
        coalesce(sum(coalesce(final_shipping_ghs, estimated_shipping_ghs)), 0)::numeric,
        2
      )
    ) AS value
    FROM filtered
  ),
  paged AS (
    SELECT coalesce(jsonb_agg(row_to_json(q)::jsonb), '[]'::jsonb) AS rows
    FROM (
      SELECT
        id,
        tracking_id,
        carrier_reference,
        package_name,
        goods_class,
        cbm,
        status,
        shipping_payment_status,
        estimated_shipping_usd,
        estimated_shipping_ghs,
        final_shipping_ghs,
        freight_included,
        customer_email,
        customer_name,
        warehouse_received_at,
        effective_received_at,
        loaded_at,
        estimated_arrival_at,
        arrived_at,
        shipping_paid_at,
        created_at
      FROM filtered
      ORDER BY effective_received_at DESC NULLS LAST, created_at DESC
      LIMIT v_limit
      OFFSET v_offset
    ) q
  )
  SELECT jsonb_build_object(
    'total', counted.total,
    'page', v_page,
    'page_size', v_page_size,
    'export_capped', p_export AND counted.total > 5000,
    'summary', coalesce(summary.value, '{}'::jsonb),
    'packages', coalesce(paged.rows, '[]'::jsonb)
  )
  INTO v_result
  FROM counted, summary, paged;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.shipping_packages_analytics(
  timestamptz, timestamptz, text, text, integer, integer, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shipping_packages_analytics(
  timestamptz, timestamptz, text, text, integer, integer, boolean
) TO service_role;
GRANT EXECUTE ON FUNCTION public.shipping_packages_analytics(
  timestamptz, timestamptz, text, text, integer, integer, boolean
) TO authenticated;
