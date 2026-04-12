# Store

A Next.js e-commerce storefront with Supabase backend.

## Getting Started

1. Copy environment variables and configure:

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase URL, keys, and optional services.
   ```

2. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Features

- Product catalog, cart, wishlist, and checkout
- Admin dashboard (products, orders, CMS settings)
- Supabase for auth, database, and storage
- Optional: Resend email, payment provider, SMS, cron

## Supabase storage (admin images)

If you see **"Bucket not found"** when uploading category or product images, create a **public** storage bucket named `products` in your Supabase project (Storage → New bucket). See `SUPABASE_STORAGE.md` for steps.

## Scripts

- `npm run dev` — development server
- `npm run build` / `npm run start` — production
- `npm run supabase:link` — link to your Supabase project (set `YOUR_PROJECT_REF` in package.json or use `supabase link` with your ref)
- `npm run create-admin` — create an admin user (uses `ADMIN_EMAIL` from .env.local or pass email/password)

## Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
