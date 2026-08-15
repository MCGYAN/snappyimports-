-- A package belongs to one customer, not one order. Its contents may come
-- from several paid orders owned by that customer.

ALTER TABLE public.shipping_packages
  ADD COLUMN IF NOT EXISTS customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_email text;

UPDATE public.shipping_packages AS package
SET
  customer_user_id = COALESCE(package.customer_user_id, orders.user_id),
  customer_email = COALESCE(package.customer_email, lower(orders.email))
FROM public.orders
WHERE orders.id = package.order_id;

ALTER TABLE public.shipping_packages
  DROP CONSTRAINT IF EXISTS shipping_packages_order_id_fkey;

ALTER TABLE public.shipping_packages
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.shipping_packages
  ADD CONSTRAINT shipping_packages_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shipping_packages_customer_user_idx
  ON public.shipping_packages (customer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS shipping_packages_customer_email_idx
  ON public.shipping_packages (lower(customer_email), created_at DESC);

COMMENT ON COLUMN public.shipping_packages.order_id IS
  'Legacy anchor order. Package membership is defined by shipping_package_items.';
COMMENT ON COLUMN public.shipping_packages.customer_user_id IS
  'Account owner for this package when the customer has signed in.';
COMMENT ON COLUMN public.shipping_packages.customer_email IS
  'Normalized customer email used for package ownership and guest access.';
