-- Give the new bell useful recent context immediately after launch.
INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
SELECT
  profile.id,
  'order_created',
  'New shop order',
  COALESCE(
    NULLIF(TRIM(CONCAT(
      orders.shipping_address ->> 'firstName',
      ' ',
      orders.shipping_address ->> 'lastName'
    )), ''),
    orders.email,
    'A customer'
  ) || ' placed ' || orders.order_number || ' for GH¢' ||
  TO_CHAR(orders.total, 'FM999,999,999,990.00') || '.',
  jsonb_build_object(
    'href', '/admin/orders/' || orders.id,
    'entity_id', orders.id,
    'entity_number', orders.order_number
  ),
  orders.created_at
FROM public.profiles AS profile
CROSS JOIN public.orders AS orders
WHERE profile.role::text IN ('admin', 'staff')
  AND orders.created_at >= now() - interval '30 days'
ON CONFLICT DO NOTHING;

INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
SELECT
  profile.id,
  'order_paid',
  'Shop payment received',
  orders.order_number || ' is paid. GH¢' ||
  TO_CHAR(orders.total, 'FM999,999,999,990.00') ||
  ' is included in shop revenue.',
  jsonb_build_object(
    'href', '/admin/orders/' || orders.id,
    'entity_id', orders.id,
    'entity_number', orders.order_number
  ),
  orders.updated_at
FROM public.profiles AS profile
CROSS JOIN public.orders AS orders
WHERE profile.role::text IN ('admin', 'staff')
  AND orders.payment_status::text = 'paid'
  AND orders.updated_at >= now() - interval '30 days'
ON CONFLICT DO NOTHING;

INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
SELECT
  profile.id,
  'exchange_created',
  'New Buy RMB request',
  exchange_orders.customer_name || ' locked ' ||
  exchange_orders.currency_from || ' ' ||
  TO_CHAR(exchange_orders.amount_from, 'FM999,999,999,990.00') ||
  ' for ' || TO_CHAR(exchange_orders.amount_to, 'FM999,999,999,990.00') || ' RMB.',
  jsonb_build_object(
    'href', '/admin/exchange/' || exchange_orders.exchange_number,
    'entity_id', exchange_orders.id,
    'entity_number', exchange_orders.exchange_number
  ),
  exchange_orders.created_at
FROM public.profiles AS profile
CROSS JOIN public.exchange_orders
WHERE profile.role::text IN ('admin', 'staff')
  AND exchange_orders.created_at >= now() - interval '30 days'
ON CONFLICT DO NOTHING;

INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
SELECT
  profile.id,
  'exchange_paid',
  'Buy RMB payment confirmed',
  exchange_orders.currency_from || ' ' ||
  TO_CHAR(exchange_orders.amount_from, 'FM999,999,999,990.00') ||
  ' was confirmed for ' || exchange_orders.exchange_number || '.',
  jsonb_build_object(
    'href', '/admin/exchange/' || exchange_orders.exchange_number,
    'entity_id', exchange_orders.id,
    'entity_number', exchange_orders.exchange_number
  ),
  exchange_orders.updated_at
FROM public.profiles AS profile
CROSS JOIN public.exchange_orders
WHERE profile.role::text IN ('admin', 'staff')
  AND exchange_orders.payment_status::text = 'paid'
  AND exchange_orders.updated_at >= now() - interval '30 days'
ON CONFLICT DO NOTHING;
