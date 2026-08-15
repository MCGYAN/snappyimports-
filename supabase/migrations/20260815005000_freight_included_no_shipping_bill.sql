-- Packages whose freight is already paid inside the product price (CIF Tema, DDP)
-- must never receive a shipping invoice. Void the zero cedi bills that were
-- issued before this rule existed and settle the packages.

UPDATE public.financial_documents AS fd
SET status = 'void',
    updated_at = now()
FROM public.shipping_packages AS sp
WHERE fd.shipping_package_id = sp.id
  AND fd.flow = 'shipping'
  AND fd.document_type = 'invoice'
  AND sp.freight_included IS TRUE
  AND fd.status <> 'void';

UPDATE public.shipping_packages
SET final_shipping_ghs = 0,
    shipping_payment_status = 'paid',
    shipping_paid_at = COALESCE(shipping_paid_at, now()),
    updated_at = now()
WHERE freight_included IS TRUE
  AND status IN ('arrived', 'clearing', 'ready', 'delivered')
  AND shipping_payment_status IS DISTINCT FROM 'paid';
