-- Multi-country Buy RMB: GH / NG / TZ corridors
CREATE TABLE IF NOT EXISTS public.exchange_corridor_rates (
  country_code text PRIMARY KEY CHECK (country_code IN ('GH', 'NG', 'TZ')),
  currency_code text NOT NULL,
  buy_rmb_rate numeric NOT NULL DEFAULT 0,
  sell_rmb_rate numeric NOT NULL DEFAULT 0,
  min_amount numeric NOT NULL DEFAULT 100,
  max_amount numeric,
  notes text,
  valid_until timestamptz,
  is_live boolean NOT NULL DEFAULT false,
  pay_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exchange_corridor_rates IS
  'Per-country Buy RMB rate board, live switch, and local pay-in accounts';

INSERT INTO public.exchange_corridor_rates (
  country_code, currency_code, buy_rmb_rate, sell_rmb_rate,
  min_amount, max_amount, notes, valid_until, is_live, pay_accounts, updated_at
)
SELECT
  'GH',
  'GHS',
  COALESCE(b.buy_rmb_rate, 0.54),
  COALESCE(b.sell_rmb_rate, 0.54),
  COALESCE(b.min_amount_ghs, 100),
  b.max_amount_ghs,
  b.notes,
  b.valid_until,
  true,
  '[
    {"holder":"Snappy Sampson Enterprise","bank":"Prudential Bank","accountNumber":"0304003190019","channel":"bank"},
    {"holder":"Snappy Sampson Enterprise","bank":"Stanbic Bank","accountNumber":"9040014178591","branch":"Graphic Road","channel":"bank"},
    {"holder":"Snappy Sampson Enterprise","bank":"MTN AGENT","accountNumber":"0550016939","registeredName":"Sampson Dziwornu Amadah","channel":"momo"}
  ]'::jsonb,
  COALESCE(b.updated_at, now())
FROM (SELECT 1) AS _
LEFT JOIN public.exchange_rate_board b ON b.id = 1
ON CONFLICT (country_code) DO NOTHING;

INSERT INTO public.exchange_corridor_rates (
  country_code, currency_code, buy_rmb_rate, sell_rmb_rate,
  min_amount, max_amount, notes, valid_until, is_live, pay_accounts, updated_at
) VALUES
  ('NG', 'NGN', 0, 0, 10000, NULL, 'Add Nigeria receiving accounts and publish today''s rate before going live.', NULL, false, '[]'::jsonb, now()),
  ('TZ', 'TZS', 0, 0, 50000, NULL, 'Add Tanzania receiving accounts and publish today''s rate before going live.', NULL, false, '[]'::jsonb, now())
ON CONFLICT (country_code) DO NOTHING;

ALTER TABLE public.exchange_orders
  ADD COLUMN IF NOT EXISTS country_code text;

UPDATE public.exchange_orders
SET country_code = 'GH'
WHERE country_code IS NULL;

ALTER TABLE public.exchange_orders
  ALTER COLUMN country_code SET DEFAULT 'GH';

ALTER TABLE public.exchange_orders
  DROP CONSTRAINT IF EXISTS exchange_orders_country_code_check;

ALTER TABLE public.exchange_orders
  ADD CONSTRAINT exchange_orders_country_code_check
  CHECK (country_code IN ('GH', 'NG', 'TZ'));

ALTER TABLE public.exchange_orders
  DROP CONSTRAINT IF EXISTS exchange_orders_direction_check;

ALTER TABLE public.exchange_orders
  ADD CONSTRAINT exchange_orders_direction_check
  CHECK (direction IN ('ghs_to_rmb', 'rmb_to_ghs', 'ngn_to_rmb', 'tzs_to_rmb'));

CREATE INDEX IF NOT EXISTS exchange_orders_country_code_idx
  ON public.exchange_orders (country_code, created_at DESC);
