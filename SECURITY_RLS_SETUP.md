# Supabase Row Level Security (RLS)

## Why This Matters

Your Supabase **anon key is public** (visible in browser JavaScript). Without RLS,
anyone who finds it can query **all** your tables directly, dumping every order,
customer, and admin record. RLS ensures only the right people get the right data.

---

## Quickest Way to Apply (2 minutes)

### Option A — SQL Editor (recommended, no setup needed)

1. Open your Supabase SQL Editor:  
   **https://supabase.com/dashboard/project/axabkvacexbexeeazzpy/sql/new**

2. Copy the entire contents of **`scripts/enable-rls.sql`** from this repo.

3. Paste it into the editor and click **Run**.

4. The last query in the file is a verification `SELECT` — check that every
   table shows `✅ SECURED`.

---

### Option B — Automated script (requires DB password)

1. Find your database password:  
   **Supabase Dashboard → Project Settings → Database → Database password**  
   *(Reset it if you've never set it.)*

2. Add to `.env.local`:
   ```
   SUPABASE_DB_PASSWORD=your-actual-db-password
   ```

3. Run:
   ```bash
   node scripts/apply-rls-direct.mjs
   ```

---

## What the SQL Secures

| Table | Policy |
|---|---|
| `orders` | Users see **only their own** orders. Guest orders are server-only (service_role). |
| `order_items` | Same as orders. Removed the `guest order items` public exposure hole. |
| `order_status_history` | Users see history only for their orders. |
| `profiles` | Users see/edit only their own. Staff can read all. |
| `addresses` | Users manage their own. Staff manage all. |
| `customers` | **Admin/staff + service_role only**. Completely blocked from anon/users. |
| `products` | Public sees **active** only. Staff see all (drafts, archived). |
| `product_images` | Public read. Staff write. |
| `product_variants` | Public read. Staff write. |
| `categories` | Public read. Staff write. |
| `coupons` | Public sees only **active** coupons within their date window. Staff manage all. |
| `reviews` | Public sees only **approved**. Users see/edit their own pending reviews. |
| `review_images` | Public sees images for approved reviews only. |
| `blog_posts` | Public sees only **published**. Staff see drafts. |
| `banners` | Public sees only **active** banners. Staff manage all. |
| `cms_content` | Public reads **active** blocks. Admin manages all. |
| `site_settings` | Public read. Admin write. |
| `store_settings` | Public read. Admin write. |
| `store_modules` | Public read. **Admin/staff only write** (fixed hole: any user could toggle features). |
| `navigation_menus` | Public read. Admin write. |
| `navigation_items` | Public sees active items. Admin manages all. |
| `pages` | Public read. Admin write. |
| `cart_items` | Users see/manage only their own cart. |
| `wishlist_items` | Users see/manage only their own wishlist. |
| `support_tickets` | Users manage their own tickets. Staff manage all. |
| `support_messages` | Users see messages on their own tickets. Staff manage all. |
| `return_requests` | Users see/create their own returns. Staff manage all. |
| `return_items` | Users see items on their own returns. Staff manage all. |
| `notifications` | Users manage their own. Staff can read all. |
| `audit_logs` | Staff/admin read-only. Only service_role can insert. |

### Storage Buckets

| Bucket | Policy |
|---|---|
| `products` | Public read. Admin/staff upload/update/delete. |
| `media` | Public read. Admin/staff upload/delete. |
| `avatars` | Public read. Users manage their own folder. |
| `blog` | Public read. Staff upload/delete. |
| `reviews` | Public read. Authenticated users upload. |

---

## Security Holes Fixed vs Old Scripts

| Issue | Fix |
|---|---|
| `"Enable select for guest orders"` — anyone could SELECT all guest orders via anon key | **Removed.** Guest orders are only accessible via service_role on the server. |
| `"Enable select for guest order items"` — same exposure for order items | **Removed.** |
| `"Allow authenticated update"` on `store_modules` — any logged-in user could toggle site features | **Removed.** Admin/staff only. |
| `coupons` exposing inactive/future/expired codes | Now filters to `is_active = true` within date window. |
| `reviews` exposing pending/rejected reviews publicly | Now only approved reviews are public. |
| `blog_posts` exposing draft posts publicly | Now only published posts are public. |
| `cms_content` / `banners` exposing inactive blocks | Now filters `is_active = true`. |
| `audit_logs` allowing any staff to insert (potential log tampering) | Only `service_role` may insert. |

---

## Verification

After applying, open the browser DevTools console on your live site and run:

```javascript
// Should return [] or error — NOT your customer list
const { data } = await supabase.from('customers').select('*');
console.log(data);

// Should return [] — not all orders
const { data: orders } = await supabase.from('orders').select('*');
console.log(orders);
```

Both should be empty arrays (or an error), not real data.

---

## Add to `.env.local` (if missing)

```
MOOLRE_CALLBACK_SECRET=<generate a strong random string from your Moolre dashboard>
SUPABASE_DB_PASSWORD=<your Supabase project DB password>
NEXT_PUBLIC_APP_URL=https://example.com
NEXT_PUBLIC_SITE_NAME=Store
```
