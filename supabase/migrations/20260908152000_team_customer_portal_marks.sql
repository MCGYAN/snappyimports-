-- Admin and staff can use the storefront account as a real customer would.
-- Their dashboard role and permissions are unchanged.

UPDATE public.profiles AS profile
SET
  full_name = COALESCE(
    NULLIF(profile.full_name, ''),
    NULLIF(auth_user.raw_user_meta_data ->> 'full_name', ''),
    btrim(
      concat_ws(
        ' ',
        auth_user.raw_user_meta_data ->> 'first_name',
        auth_user.raw_user_meta_data ->> 'last_name'
      )
    )
  ),
  phone = COALESCE(
    NULLIF(profile.phone, ''),
    NULLIF(auth_user.raw_user_meta_data ->> 'phone', ''),
    auth_user.phone
  ),
  shipping_mark = public.surname_shipping_mark(
    COALESCE(
      NULLIF(profile.full_name, ''),
      NULLIF(auth_user.raw_user_meta_data ->> 'full_name', ''),
      btrim(
        concat_ws(
          ' ',
          auth_user.raw_user_meta_data ->> 'first_name',
          auth_user.raw_user_meta_data ->> 'last_name'
        )
      )
    ),
    profile.email,
    profile.id
  )
FROM auth.users AS auth_user
WHERE auth_user.id = profile.id
  AND profile.role::text IN ('admin', 'staff');
