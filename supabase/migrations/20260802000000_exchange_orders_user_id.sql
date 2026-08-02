-- Link RMB exchange orders to store accounts (claim + order history)

ALTER TABLE public.exchange_orders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exchange_orders_user_id
  ON public.exchange_orders (user_id);

CREATE INDEX IF NOT EXISTS idx_exchange_orders_email
  ON public.exchange_orders (lower(email))
  WHERE email IS NOT NULL;

-- Customers can read their own linked exchanges in the account client
DROP POLICY IF EXISTS "Users view own exchange orders" ON public.exchange_orders;
CREATE POLICY "Users view own exchange orders"
  ON public.exchange_orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
