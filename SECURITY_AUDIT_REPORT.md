# Security Audit Report — SAMBATEK STORE

Completed per **SECURITY_AUDIT_PROMPT.md**. Summary of findings and fixes.

---

## 1. RLS (Row Level Security)

- **Status:** Already applied in a previous session via `scripts/enable-rls.sql` and MCP migrations.
- **Verification:** All 31 public tables have RLS enabled; no anonymous SELECT on `orders`, `order_items`, or `customers`.
- **Action:** None. Re-run `scripts/enable-rls.sql` in Supabase SQL Editor if you add new tables.

---

## 2. Supabase SECURITY DEFINER Functions

- **Finding:** `mark_order_paid` and `update_customer_stats` are SECURITY DEFINER and could be called with the anon key if someone discovered the RPC endpoint.
- **Fix:** Migration **`supabase/migrations/20260227000000_secure_security_definer_functions.sql`** adds a guard at the top of both functions:
  - `auth.role() IS DISTINCT FROM 'service_role'` → `RAISE EXCEPTION 'Access denied'`
- **Action:** Apply the migration:
  - **Option A:** Supabase Dashboard → SQL Editor → paste and run the contents of `supabase/migrations/20260227000000_secure_security_definer_functions.sql`
  - **Option B:** `supabase db push` (if using Supabase CLI)

---

## 3. Payment Endpoints

| Area | Status | Change |
|------|--------|--------|
| **Initiation** (`/api/payment/moolre`) | OK | Amount from DB only; rate limited. |
| **Verify** (`/api/payment/moolre/verify`) | OK | No trust of `fromRedirect`; Moolre API + amount check; rate limited. |
| **Callback** (`/api/payment/moolre/callback`) | OK | Secret required when `MOOLRE_CALLBACK_SECRET` set; amount mismatch → 403; uses `supabaseAdmin`. |
| **Order-success page** | Fixed | No longer uses client `supabase` (blocked by RLS for guest orders). Fetches via **GET `/api/order-success?order=...`** (returns order only if paid in last 15 minutes). |

---

## 4. Middleware & Admin Auth

- **Finding:** Middleware only allowed `role === 'admin'`; staff were rejected.
- **Fix:** Middleware and **`lib/auth.ts`** now allow **`admin` or `staff`** for `/admin` and for `verifyAuth(..., { requireAdmin: true })` / `verifyAdminToken()`.
- **Headers:** `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Cache-Control: no-store` for admin already present.

---

## 5. Notification API

- **Status:** Already correct. Admin-only types require `verifyAuth(request, { requireAdmin: true })`; `order_created` checks order exists and is &lt; 10 min old; `contact` is validated and rate-limited; campaign uses `escapeHtml()`.

---

## 6. Order Tracking

- **Finding:** Page used client `supabase`; with RLS, guest orders are not selectable by anon.
- **Fix:**
  - **GET `/api/order-tracking?order=...&email=...`** added. Uses `supabaseAdmin`; returns order only if `order.email` matches provided email (case-insensitive).
  - Order-tracking page now uses this API only; email is required; label updated to “Email Address (Required)”.

---

## 7. Server Actions

- **Status:** `app/admin/test-sms/actions.ts` uses `verifyAdminToken(authToken)` and does not expose stack traces. No change.

---

## 8. HTML Sanitization

- **Status:** **`lib/sanitize.ts`** exists with `escapeHtml()`, `sanitizeHtml()`, `isValidEmail()`, `isValidGhanaPhone()`. **`lib/notifications.ts`** uses `escapeHtml` for user content. No change.

---

## 9. Environment & Secrets

- **Status:** `SUPABASE_SERVICE_ROLE_KEY` is not under `NEXT_PUBLIC_*`; **`lib/supabase-admin.ts`** uses it server-side only; **`lib/supabase.ts`** uses anon key only; **`lib/auth.ts`** provides `verifyAuth` and `verifyAdminToken`. No change.

---

## 10. Supabase Security Advisor

- **Action:** Run in Supabase (e.g. via MCP or Dashboard):
  ```text
  get_advisors({ type: "security" })
  ```
  Address any reported warnings.

---

## New / Updated Files

| File | Purpose |
|------|--------|
| `app/api/order-success/route.ts` | GET order for success page; only if paid in last 15 min. |
| `app/api/order-tracking/route.ts` | GET order for tracking; requires matching email. |
| `supabase/migrations/20260227000000_secure_security_definer_functions.sql` | Restrict `mark_order_paid` and `update_customer_stats` to `service_role`. |

---

## Checklist for You

1. Apply **`supabase/migrations/20260227000000_secure_security_definer_functions.sql`** in Supabase (SQL Editor or `supabase db push`).
2. Set **`MOOLRE_CALLBACK_SECRET`** in production so payment callbacks are verified.
3. Run **`tsc --noEmit`** (and fix any type errors if they appear).
4. Run Supabase security advisor and fix any remaining issues.
