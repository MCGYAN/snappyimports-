-- Staff module permissions for admin dashboard

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.admin_permissions IS
  'For role=staff: { orders, exchange, products, customers } booleans. Admin role ignores this and has full access.';

CREATE INDEX IF NOT EXISTS idx_profiles_admin_permissions
  ON public.profiles USING gin (admin_permissions)
  WHERE role = 'staff';

CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role::text INTO actor_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF actor_role IS DISTINCT FROM 'admin' THEN
    NEW.role := OLD.role;
    NEW.admin_permissions := OLD.admin_permissions;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileges ON public.profiles;
CREATE TRIGGER guard_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privileges();
