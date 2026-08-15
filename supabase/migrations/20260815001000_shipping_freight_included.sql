ALTER TABLE public.shipping_packages
  ADD COLUMN IF NOT EXISTS freight_included boolean NOT NULL DEFAULT false;
