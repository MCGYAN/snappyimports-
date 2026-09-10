-- Customer portal shows Ghana + China tracking phones and a Chinese-first label.
-- English address remains admin-only.

ALTER TABLE public.china_warehouse_settings
  ADD COLUMN IF NOT EXISTS ghana_tracking_phone text;

UPDATE public.china_warehouse_settings
SET
  address_chinese = regexp_replace(
    COALESCE(address_chinese, ''),
    '入仓号[:：]?\s*[\d;\s,，]+$',
    '',
    'g'
  ),
  tracking_whatsapp = COALESCE(
    NULLIF(tracking_whatsapp, ''),
    NULLIF(phone, ''),
    tracking_whatsapp
  ),
  entry_numbers = COALESCE(NULLIF(entry_numbers, ''), entry_numbers),
  instructions = COALESCE(
    NULLIF(instructions, ''),
    'Copy the shipping label and send it to your supplier. Put the shipping mark clearly on every carton.'
  )
WHERE id = 1;

UPDATE public.china_warehouse_settings
SET address_chinese = btrim(address_chinese)
WHERE id = 1;
