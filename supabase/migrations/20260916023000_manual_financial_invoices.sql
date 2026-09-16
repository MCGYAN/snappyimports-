-- Allow admin-created standalone invoices (light records, PDF on demand).
ALTER TABLE public.financial_documents
  DROP CONSTRAINT IF EXISTS financial_documents_flow_check;

ALTER TABLE public.financial_documents
  ADD CONSTRAINT financial_documents_flow_check
  CHECK (flow IN ('shop', 'rmb', 'shipping', 'manual'));

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
              (financial_documents.flow IN ('shop', 'shipping', 'manual')
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
              (financial_documents.flow IN ('shop', 'shipping', 'manual')
                AND COALESCE((profiles.admin_permissions ->> 'orders')::boolean, false))
              OR
              (financial_documents.flow = 'rmb'
                AND COALESCE((profiles.admin_permissions ->> 'exchange')::boolean, false))
            )
          )
        )
    )
  );
