-- Gate manual invoices behind invoices staff permission.
-- Block deletes on financial_documents for authenticated dashboard users.

DROP POLICY IF EXISTS "Staff manage financial documents" ON public.financial_documents;
DROP POLICY IF EXISTS "Staff select financial documents" ON public.financial_documents;
DROP POLICY IF EXISTS "Staff insert financial documents" ON public.financial_documents;
DROP POLICY IF EXISTS "Staff update financial documents" ON public.financial_documents;

CREATE POLICY "Staff select financial documents"
  ON public.financial_documents FOR SELECT TO authenticated
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
              (financial_documents.flow = 'manual'
                AND COALESCE((profiles.admin_permissions ->> 'invoices')::boolean, false))
              OR
              (financial_documents.flow = 'rmb'
                AND COALESCE((profiles.admin_permissions ->> 'exchange')::boolean, false))
            )
          )
        )
    )
  );

CREATE POLICY "Staff insert financial documents"
  ON public.financial_documents FOR INSERT TO authenticated
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
              (financial_documents.flow = 'manual'
                AND COALESCE((profiles.admin_permissions ->> 'invoices')::boolean, false))
              OR
              (financial_documents.flow = 'rmb'
                AND COALESCE((profiles.admin_permissions ->> 'exchange')::boolean, false))
            )
          )
        )
    )
  );

CREATE POLICY "Staff update financial documents"
  ON public.financial_documents FOR UPDATE TO authenticated
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
              (financial_documents.flow = 'manual'
                AND COALESCE((profiles.admin_permissions ->> 'invoices')::boolean, false))
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
              (financial_documents.flow = 'manual'
                AND COALESCE((profiles.admin_permissions ->> 'invoices')::boolean, false))
              OR
              (financial_documents.flow = 'rmb'
                AND COALESCE((profiles.admin_permissions ->> 'exchange')::boolean, false))
            )
          )
        )
    )
  );

-- Intentionally no DELETE policy for authenticated users. Invoice history cannot be removed from the dashboard.

COMMENT ON COLUMN public.profiles.admin_permissions IS
  'For role=staff: { orders, warehouse, exchange, products, customers, invoices } booleans. Admin role ignores this and has full access.';
