-- Financial records, delayed receipt delivery, and Ghana freight billing.
CREATE TABLE IF NOT EXISTS public.financial_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text NOT NULL UNIQUE,
  document_type text NOT NULL CHECK (document_type IN ('invoice', 'receipt')),
  flow text NOT NULL CHECK (flow IN ('shop', 'rmb', 'shipping')),
  entity_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  exchange_order_id uuid REFERENCES public.exchange_orders(id) ON DELETE CASCADE,
  shipping_package_id uuid REFERENCES public.shipping_packages(id) ON DELETE CASCADE,
  customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email text,
  currency text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paid', 'expired', 'void')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  paid_at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS financial_documents_entity_version_idx
  ON public.financial_documents (flow, entity_id, document_type, version);
CREATE INDEX IF NOT EXISTS financial_documents_customer_idx
  ON public.financial_documents (customer_user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS financial_documents_email_idx
  ON public.financial_documents (lower(customer_email), issued_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('receipt_email')),
  recipient text NOT NULL,
  subject text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'cancelled', 'failed')),
  send_after timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_outbox_due_idx
  ON public.notification_outbox (status, send_after)
  WHERE status = 'pending';

ALTER TABLE public.shipping_rate_board
  ADD COLUMN IF NOT EXISTS invoice_valid_days integer NOT NULL DEFAULT 5
    CHECK (invoice_valid_days BETWEEN 1 AND 30);

ALTER TABLE public.shipping_packages
  ADD COLUMN IF NOT EXISTS shipping_payment_status text NOT NULL DEFAULT 'not_billed'
    CHECK (shipping_payment_status IN ('not_billed', 'unpaid', 'awaiting_confirmation', 'paid')),
  ADD COLUMN IF NOT EXISTS shipping_payment_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipping_payment_confirmed_by uuid REFERENCES auth.users(id);

ALTER TABLE public.financial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers read own financial documents" ON public.financial_documents;
CREATE POLICY "Customers read own financial documents"
  ON public.financial_documents FOR SELECT TO authenticated
  USING (customer_user_id = auth.uid());

DROP POLICY IF EXISTS "Staff manage financial documents" ON public.financial_documents;
CREATE POLICY "Staff manage financial documents"
  ON public.financial_documents FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role::text = 'admin'
          OR (
            profiles.role::text = 'staff'
            AND (
              (financial_documents.flow IN ('shop', 'shipping')
                AND COALESCE((profiles.admin_permissions ->> 'orders')::boolean, false))
              OR
              (financial_documents.flow = 'rmb'
                AND COALESCE((profiles.admin_permissions ->> 'exchange')::boolean, false))
            )
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND (
          profiles.role::text = 'admin'
          OR (
            profiles.role::text = 'staff'
            AND (
              (financial_documents.flow IN ('shop', 'shipping')
                AND COALESCE((profiles.admin_permissions ->> 'orders')::boolean, false))
              OR
              (financial_documents.flow = 'rmb'
                AND COALESCE((profiles.admin_permissions ->> 'exchange')::boolean, false))
            )
          )
        )
    )
  );

DROP TRIGGER IF EXISTS update_financial_documents_updated_at ON public.financial_documents;
CREATE TRIGGER update_financial_documents_updated_at
  BEFORE UPDATE ON public.financial_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_outbox_updated_at ON public.notification_outbox;
CREATE TRIGGER update_notification_outbox_updated_at
  BEFORE UPDATE ON public.notification_outbox
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Manual confirmation can be reversed only during the short safety window.
CREATE OR REPLACE FUNCTION public.undo_manual_order_payment(order_ref text, actor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target orders;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO target FROM orders WHERE order_number = order_ref FOR UPDATE;
  IF target.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF target.payment_status::text <> 'paid'
    OR COALESCE((target.metadata->>'manual_payment')::boolean, false) IS NOT TRUE
    OR (target.metadata->>'payment_confirmed_at')::timestamptz < now() - interval '2 minutes'
  THEN
    RAISE EXCEPTION 'Undo window closed';
  END IF;

  IF COALESCE((target.metadata->>'stock_reduced')::boolean, false) THEN
    UPDATE products p SET quantity = p.quantity + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = target.id AND oi.product_id = p.id;

    UPDATE product_variants pv SET quantity = pv.quantity + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = target.id
      AND oi.product_id = pv.product_id
      AND oi.variant_name IS NOT NULL
      AND oi.variant_name = pv.name;
  END IF;

  UPDATE orders
  SET payment_status = 'awaiting_confirmation',
      status = 'pending',
      metadata = (COALESCE(metadata, '{}'::jsonb)
        - 'payment_confirmed_at' - 'payment_confirmed_by' - 'payment_confirm_note'
        - 'manual_payment' - 'payment_verified_at' - 'stock_reduced')
        || jsonb_build_object(
          'fulfillment_stage', 'payment_sent',
          'payment_undo_at', now(),
          'payment_undo_by', actor_id
        ),
      updated_at = now()
  WHERE id = target.id
  RETURNING * INTO target;

  UPDATE public.financial_documents
  SET status = 'void', updated_at = now()
  WHERE flow = 'shop' AND entity_id = target.id AND document_type = 'receipt' AND status <> 'void';

  UPDATE public.notification_outbox
  SET status = 'cancelled', updated_at = now()
  WHERE event_key = 'shop-receipt:' || target.id::text AND status = 'pending';

  RETURN to_jsonb(target);
END;
$$;
