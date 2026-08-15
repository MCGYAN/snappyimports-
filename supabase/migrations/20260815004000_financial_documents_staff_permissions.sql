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
