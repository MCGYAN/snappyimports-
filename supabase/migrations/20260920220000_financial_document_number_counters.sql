-- Sequential document numbers per prefix (INV-MAN-0001, INV-SHP-0001, RCT-ORD-0001, …).
-- Existing long stamp/random numbers are left unchanged; only new documents use this.

CREATE TABLE IF NOT EXISTS public.financial_document_counters (
  prefix text PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.financial_document_counters (prefix, last_value)
VALUES
  ('INV-MAN', 0),
  ('INV-SHP', 0),
  ('RCT-ORD', 0),
  ('RCT-RMB', 0),
  ('RCT-SHP', 0)
ON CONFLICT (prefix) DO NOTHING;

CREATE OR REPLACE FUNCTION public.next_financial_document_number(p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cleaned text;
  next_val bigint;
  width int;
  caller_role text := coalesce(auth.role(), '');
BEGIN
  IF caller_role IS DISTINCT FROM 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Access denied: next_financial_document_number requires service role';
  END IF;

  cleaned := upper(trim(both FROM coalesce(p_prefix, '')));
  IF cleaned = '' OR cleaned !~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' THEN
    RAISE EXCEPTION 'Invalid document number prefix: %', p_prefix;
  END IF;

  INSERT INTO public.financial_document_counters (prefix, last_value, updated_at)
  VALUES (cleaned, 1, now())
  ON CONFLICT (prefix) DO UPDATE
    SET last_value = public.financial_document_counters.last_value + 1,
        updated_at = now()
  RETURNING public.financial_document_counters.last_value INTO next_val;

  width := GREATEST(4, length(next_val::text));
  RETURN cleaned || '-' || lpad(next_val::text, width, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_financial_document_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_financial_document_number(text) TO service_role;

ALTER TABLE public.financial_document_counters ENABLE ROW LEVEL SECURITY;
