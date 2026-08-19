-- Let admin re-save product variants when old order rows still reference them.
-- order_items keeps product_name + variant_name snapshots for history.
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_variant_id_fkey
  FOREIGN KEY (variant_id)
  REFERENCES public.product_variants(id)
  ON DELETE SET NULL;
