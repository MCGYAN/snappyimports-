-- Existing confirmed payments should also appear in customer financial records.
INSERT INTO public.financial_documents (
  document_number, document_type, flow, entity_id, order_id, customer_user_id,
  customer_email, currency, amount, status, issued_at, paid_at, data
)
SELECT
  'RCT-ORD-' || upper(substr(md5(orders.id::text), 1, 12)),
  'receipt',
  'shop',
  orders.id,
  orders.id,
  orders.user_id,
  orders.email,
  COALESCE(orders.currency, 'GHS'),
  orders.total,
  'paid',
  COALESCE((orders.metadata->>'payment_confirmed_at')::timestamptz, orders.updated_at),
  COALESCE((orders.metadata->>'payment_confirmed_at')::timestamptz, orders.updated_at),
  jsonb_build_object(
    'reference', orders.order_number,
    'payment_method', COALESCE(orders.payment_method, 'Payment'),
    'historical', true
  )
FROM public.orders
WHERE orders.payment_status::text = 'paid'
ON CONFLICT (document_number) DO NOTHING;

INSERT INTO public.financial_documents (
  document_number, document_type, flow, entity_id, exchange_order_id, customer_user_id,
  customer_email, currency, amount, status, issued_at, paid_at, data
)
SELECT
  'RCT-RMB-' || upper(substr(md5(exchange_orders.id::text), 1, 12)),
  'receipt',
  'rmb',
  exchange_orders.id,
  exchange_orders.id,
  exchange_orders.user_id,
  exchange_orders.email,
  COALESCE(exchange_orders.currency_from, 'GHS'),
  exchange_orders.amount_from,
  'paid',
  COALESCE(exchange_orders.confirmed_at, exchange_orders.updated_at),
  COALESCE(exchange_orders.confirmed_at, exchange_orders.updated_at),
  jsonb_build_object(
    'reference', exchange_orders.exchange_number,
    'customer_name', exchange_orders.customer_name,
    'amount_to', exchange_orders.amount_to,
    'currency_to', 'RMB',
    'rate', exchange_orders.rate,
    'historical', true
  )
FROM public.exchange_orders
WHERE exchange_orders.payment_status::text = 'paid'
ON CONFLICT (document_number) DO NOTHING;
