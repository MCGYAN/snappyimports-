# Security Audit & Fix Prompt

> **Use this prompt with Cursor Agent (or any AI coding assistant) to perform a full security audit and fix on this Next.js e-commerce codebase.**
>
> **Prerequisites:** Ensure the AI has access to your Supabase MCP connection before starting.

---

## The Prompt

Copy everything below this line and paste it as your message to the AI:

---

I need you to perform a comprehensive security audit and fix every vulnerability in this project. This is a Next.js e-commerce application using Supabase (database + auth), Moolre (payment gateway), and Resend/Moolre SMS (notifications). You have access to the Supabase MCP — use it to inspect and fix the database directly.

Work through every category below. For each one, investigate the current state, report what you find, and then **fix it immediately** — don't just report issues.

---

### 1. SUPABASE ROW LEVEL SECURITY (RLS)

**Use the Supabase MCP tools** to do all of the following:

- Run `list_tables` to get all tables and check `rls_enabled` status on each one.
- Run `execute_sql` to query `pg_policies` and review every policy on every table:
  ```sql
  SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies WHERE schemaname = 'public'
  ORDER BY tablename, policyname;
  ```
- **Flag any policy** where `qual` is `true` or `user_id IS NULL` on sensitive tables (orders, customers, profiles, order_items). These allow anonymous access to private data.
- **Flag any policy** that grants `SELECT`, `UPDATE`, or `ALL` to the `anon` role on sensitive tables.
- **Drop dangerous policies** and replace them with secure ones:
  - `orders`: Users can only SELECT their own orders (`auth.uid() = user_id`). No anonymous SELECT on guest orders.
  - `order_items`: Users can only see items belonging to their own orders.
  - `profiles`: Users can only see/update their own profile.
  - `customers`: Admin/staff only.
  - Public data tables (products, categories, banners, images, pages, cms_content, site_settings, store_modules, navigation): Public SELECT is fine.
  - User-specific tables (cart_items, wishlist_items, addresses, notifications): Owner only (`auth.uid() = user_id`).
- Apply all fixes using `apply_migration`.

### 2. SUPABASE FUNCTIONS (RPC)

- Run `execute_sql` to list all public SECURITY DEFINER functions:
  ```sql
  SELECT p.proname, pg_catalog.pg_get_function_arguments(p.oid) as args,
         CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'INVOKER' END as security
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' ORDER BY p.proname;
  ```
- **Any SECURITY DEFINER function that takes no auth check inside is exploitable.** Anyone can call it via `POST /rest/v1/rpc/function_name` with just the anon key, and it bypasses ALL RLS.
- Read the definition of each SECURITY DEFINER function using `pg_get_functiondef(oid)`.
- **Fix each one** by adding this check at the top of the function body:
  ```sql
  IF auth.role() != 'service_role' AND NOT is_admin_or_staff() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  ```
- Pay special attention to functions that: return customer data, modify orders (mark as paid), modify stock, or modify customer records.
- Apply all fixes using `apply_migration`.

### 3. PAYMENT ENDPOINTS

Read every file under `app/api/payment/` and fix these issues:

**Payment initiation (`app/api/payment/moolre/route.ts`):**
- The `amount` must NEVER come from the client request body. Always fetch the order from the database using the service role key and use `order.total`.
- Verify the order exists and is not already paid before generating a payment link.

**Payment verification (`app/api/payment/moolre/verify/route.ts`):**
- NEVER trust a client-provided flag like `fromRedirect: true` as proof of payment. This lets anyone mark any order as paid by sending `{ orderNumber: "ORD-xxx", fromRedirect: true }`.
- The ONLY trusted source is the payment provider's API. Verify with Moolre's API endpoint and confirm the amount matches the order total.
- Add rate limiting.

**Payment callback (`app/api/payment/moolre/callback/route.ts`):**
- Secret verification must be MANDATORY when the environment variable is set. If the secret doesn't match, reject the callback with 403.
- Amount mismatch must REJECT the callback (not just log a warning).
- Success validation must be strict: require explicit status codes from the payment provider, not just string matching on the message field.
- Use the server-side Supabase admin client (service role key), not the anon key.

**Order success page (`app/(store)/order-success/page.tsx`):**
- Remove any `fromRedirect: true` parameter being sent to the verify endpoint.

### 4. MIDDLEWARE & ADMIN AUTHENTICATION

**Read `middleware.ts`** — if it only sets headers and doesn't verify authentication, it needs a full rewrite:

- For all `/admin` routes (except `/admin/login`), verify the Supabase session server-side.
- Check for the Supabase auth cookie, extract the access token, call `supabase.auth.getUser(token)`, then verify the user's profile has `role = 'admin'` or `role = 'staff'`.
- If auth fails, redirect to `/admin/login`.
- Add security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Cache-Control: no-store` for admin routes.

**Check `app/admin/layout.tsx`** — if auth is only in a client-side `useEffect`, it can be bypassed. The middleware fix above provides the server-side gate.

### 5. NOTIFICATION API

Read `app/api/notifications/route.ts` and fix:

- **ALL notification types that send emails/SMS must require authentication**, except `contact` (which is a public contact form, but must be rate-limited and validated).
- Types like `campaign`, `order_updated`, `order_status`, `payment_link`, `welcome` must require admin/staff auth (verify the Bearer token and check profile role).
- Type `order_created` should verify the order actually exists in the database and was created recently (within 10 minutes).
- Type `contact` should validate email format, enforce length limits on all fields, and be rate-limited.

### 6. ORDER TRACKING

Read `app/(store)/order-tracking/page.tsx` and fix:

- Email verification must be **mandatory**, not optional. Without it, anyone with an order number can see full customer PII (name, address, phone, email).
- The email field label should say "Required", not "optional".
- The form must not submit without an email.
- Auto-tracking from URL parameters should also require an email parameter.
- Only select the fields needed for display — never use `select('*')` which exposes unnecessary data.

### 7. SERVER ACTIONS

Read all files under `app/admin/` that use `'use server'` or server actions:

- Every server action must verify the caller is an authenticated admin/staff user.
- Never expose stack traces or internal error details in responses.
- Validate and sanitize all inputs.

### 8. HTML SANITIZATION

Read `lib/notifications.ts` (or wherever emails are composed):

- Any user-provided text (contact form name, email, subject, message; campaign subject/message) inserted into HTML email templates must be escaped using an `escapeHtml()` function that converts `<>&"'` to HTML entities.
- Create a `lib/sanitize.ts` utility with `escapeHtml()`, `sanitizeHtml()` (for blog/CMS content rendering), `isValidEmail()`, and `isValidPhoneNumberFormat()` functions.

### 9. ENVIRONMENT & SECRETS

- Check `.env.local` — the `SUPABASE_SERVICE_ROLE_KEY` must NEVER be prefixed with `NEXT_PUBLIC_`. It should only be used server-side.
- Check `lib/supabase.ts` — the client-side Supabase client should only use the `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Create a separate `lib/supabase-admin.ts` for server-side use that uses the service role key. This should never be imported in client components.
- Create a `lib/auth.ts` with reusable `verifyAuth(request, { requireAdmin })` and `verifyAdminToken(token)` functions.

### 10. SUPABASE SECURITY ADVISOR

After all fixes, run the Supabase security advisor:
```
get_advisors({ type: "security" })
```
Report any remaining warnings and fix what you can.

---

### IMPORTANT RULES

1. **Fix everything, don't just report.** Apply code changes and database migrations.
2. **Use the Supabase MCP** for all database operations — `list_tables`, `execute_sql`, `apply_migration`, `get_advisors`.
3. **Create a `lib/supabase-admin.ts`** for the service role client — never use it client-side.
4. **Create a `lib/auth.ts`** with shared auth verification functions.
5. **Create a `lib/sanitize.ts`** with HTML escaping and validation utilities.
6. **Run TypeScript type-check** (`tsc --noEmit`) after all changes to make sure nothing is broken.
7. **Don't break checkout flow** — guest orders must still work for INSERT, just not for anonymous SELECT.
8. **Don't break admin panel** — admin/staff must still be able to manage everything via their authenticated session.
