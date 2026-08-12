-- Alipay payout details for Buy RMB desk
ALTER TABLE public.exchange_orders
  ADD COLUMN IF NOT EXISTS alipay_qr_path text,
  ADD COLUMN IF NOT EXISTS alipay_account_name text;

COMMENT ON COLUMN public.exchange_orders.alipay_qr_path IS
  'Private storage path for customer Alipay receive QR image';
COMMENT ON COLUMN public.exchange_orders.alipay_account_name IS
  'Name the customer says appears on their Alipay receive profile';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exchange-alipay',
  'exchange-alipay',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
