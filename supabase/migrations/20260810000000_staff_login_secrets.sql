-- Owner-viewable staff passwords for Team page (set by owner; Auth still stores the real hash).
CREATE TABLE IF NOT EXISTS public.staff_login_secrets (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  password_plain text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.staff_login_secrets IS
  'Owner-readable staff login passwords set from Team. Not exposed to clients except via owner-only admin API.';

ALTER TABLE public.staff_login_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_login_secrets FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.staff_login_secrets FROM PUBLIC;
REVOKE ALL ON TABLE public.staff_login_secrets FROM anon, authenticated;
