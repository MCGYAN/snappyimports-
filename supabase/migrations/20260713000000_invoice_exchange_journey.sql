-- Invoice payment status + RMB exchange desk
-- Applied remotely via MCP; kept for local history.

DO $$ BEGIN
  ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'awaiting_confirmation';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.exchange_rate_board (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  buy_rmb_rate numeric NOT NULL DEFAULT 1.75,
  sell_rmb_rate numeric NOT NULL DEFAULT 1.70,
  min_amount_ghs numeric NOT NULL DEFAULT 100,
  max_amount_ghs numeric,
  notes text,
  valid_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.exchange_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  phone text NOT NULL,
  email text,
  business_name text,
  direction text NOT NULL CHECK (direction IN ('ghs_to_rmb', 'rmb_to_ghs')),
  rate numeric NOT NULL,
  amount_from numeric NOT NULL,
  amount_to numeric NOT NULL,
  currency_from text NOT NULL,
  currency_to text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_payment',
  payment_status text NOT NULL DEFAULT 'pending',
  due_at timestamptz,
  payment_sent_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,
  payment_note text,
  admin_notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
