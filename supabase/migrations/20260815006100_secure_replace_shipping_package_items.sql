REVOKE ALL ON FUNCTION public.replace_shipping_package_items(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_shipping_package_items(uuid, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.replace_shipping_package_items(uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.replace_shipping_package_items(uuid, jsonb) TO service_role;
