# Fix 404 / MIME errors for _next/static/chunks and favicon

## Symptoms

- **404** for `/_next/static/chunks/app-pages-internals.js`, `app/not-found.js`, `app/(store)/layout.js`, `app/(store)/page.js`
- **Refused to execute script… MIME type ('text/html')** — the server is returning an HTML page (e.g. 404) instead of JavaScript for chunk URLs
- **500** for `/favicon.ico`

## Causes

1. **Chunk 404/MIME**: Stale or corrupted `.next` build cache, or the dev server serving the wrong response for chunk requests. The browser may also be using cached chunk names from an old build.
2. **Favicon 500**: There was no `favicon.ico` in `public/` and no app-level icon, so the request could fail.

## Fixes applied in this project

### Favicon (500)

- **`app/icon.tsx`** was added so Next.js serves a generated icon at `/icon`.
- **`next.config.ts`** has a rewrite: `/favicon.ico` → `/icon`, so `/favicon.ico` no longer 500s.
- **`app/layout.tsx`** metadata/icons were updated to use `/icon` and `/favicon.ico` (rewritten to `/icon`).

### Chunk 404 / MIME (dev)

1. **Stop the dev server** (Ctrl+C in the terminal where `npm run dev` is running).
2. **Delete the build cache**:
   ```bash
   rm -rf .next
   ```
   On Windows PowerShell:
   ```powershell
   Remove-Item -Recurse -Force .next
   ```
3. **Restart the dev server**:
   ```bash
   npm run dev
   ```
4. **Hard-refresh the browser** (Ctrl+Shift+R or Cmd+Shift+R) or open the site in an incognito/private window so old chunk URLs are not used.

After a clean build, `/_next/static/chunks/` requests should return JavaScript with the correct MIME type and the console errors should stop.
