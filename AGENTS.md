# Agent notes

## Stack & runtime

- Astro 6 + `@astrojs/cloudflare` adapter, **server-rendered** (`output: 'server'`).
- Runs on **Cloudflare Workers**, not Node. Do not use Node built-ins.
- Tailwind CSS v4 via Vite plugin. `src/styles/global.css` holds the design system: `@theme` tokens (colors, fonts),
  base styles, and a `@layer components` block with the shared classes (`.u-wide`, `.u-title`, `.eyebrow`, `.obj`,
  `.tag`, `.panel`, `.btn`, `.field`, `.label`, `.note`, `.link`, `.navlink`, `.rule`, `.prose-body`).
- Type: Archivo Variable (display, uses the **width** axis), Newsreader Variable (body serif), JetBrains Mono (data).
- Listings use one primitive: `src/components/ObjectRow.astro` (`.obj` + a `--sigil` hue per kind of object).
  `src/scripts/image-tool.ts` and `FileBrowser.tsx` inject markup that relies on these token/class names — grep before renaming.
- Package manager: **pnpm** (10.33.0). Node: 22.12.0.

## Commands

| Task | Command |
|------|---------|
| Dev server | `pnpm dev` (Astro dev) |
| Preview (local Worker) | `pnpm preview` (`wrangler dev`) |
| Deploy | `pnpm release` (`astro build` then `wrangler deploy`) |
| Typecheck | `pnpm typecheck` (`astro check`) |
| Lint | `pnpm lint` (`biome check .`) |
| Format | `pnpm format` (`biome check --write .`) |

Order when verifying: `lint` → `typecheck` → `build` → `preview`.

## Environment setup

Copy `.dev.vars.example` → `.dev.vars` (gitignored). Required vars:

```
ADMIN_PASSWORD=...
SESSION_SECRET=...        # >= 32 bytes
S3_ENDPOINT=https://...
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
```

In production these are Wrangler secrets / bindings (see `wrangler.jsonc`).

## Architecture

- **All pages are dynamic** (`export const prerender = false` is required on every page because the default Astro behavior in `server` mode can still prerender some routes).
- **Content lives in S3**, not in this repo. Posts are `.mdx` files under the `mdx/blogs/` prefix in the configured bucket.
- **Edge caching**: public GET pages (non-admin, non-api, non-`/_`) are cached via `caches.default` in production. In dev, an in-memory `Map` emulates the cache (`src/lib/runtime.dev.ts`).
- **Cache purge is manual**: after editing content via the CMS, go to `/admin/purge` and submit the public URL(s) to evict from the edge cache. There is no automatic invalidation on CMS save.

## Cross-origin isolation (do not break this)

`/tools/imgconv` runs wasm-vips, which needs `SharedArrayBuffer`, which needs the document to be
cross-origin isolated. So **every** response on this origin gets `Cross-Origin-Opener-Policy: same-origin`
and `Cross-Origin-Embedder-Policy: require-corp` — `src/middleware.ts` for Worker responses,
`public/_headers` for static assets, and the Vite plugin in `astro.config.mjs` for dev.

Isolation is fixed when a **document** is created, and `<ClientRouter />` navigates client-side without
ever recreating it. So one non-isolated entry point poisons the whole session: land there, click through
to the tool, and `crossOriginIsolated` is still false. `/admin` used to be exempt, which is exactly how
this broke — a hard refresh "fixed" it because that builds a fresh document.

- Never exempt a path from isolation. There is nothing to exempt: admin loads no cross-origin
  subresources (S3 objects are proxied through `/api/admin/fs/get`).
- Anything embedded in a page must be same-origin or send `Cross-Origin-Resource-Policy`.
- Documents are served `Cache-Control: no-cache` so a stored copy can never replay superseded headers.
- Bump `VERSION` in `public/sw.js` when response headers change — cached responses keep the headers they
  were stored with.

## Auth & admin

- Single password login (`ADMIN_PASSWORD`). Session cookies are HMAC-signed with `SESSION_SECRET`; no server-side session storage.
- Admin routes (`/admin/*` and `/api/admin/*` except login) require a valid session cookie.

## Important files / conventions

- `wrangler.jsonc` — Worker config. `main` points to `@astrojs/cloudflare/entrypoints/server`. `SESSION` KV binding is defined there.
- `public/.assetsignore` contains `_worker.js` so Astro does not treat the worker bundle as a static asset.
- `src/lib/runtime.ts` — reads env via `cloudflare:workers` and selects the cache implementation.
- `src/lib/s3.ts` — S3 client using `aws4fetch`. Uses path-style URLs (`endpoint/bucket/key`).
- `src/middleware.ts` — handles edge-cache lookup/insert and admin session gating.
- `src/lib/markdown.ts` — remark/rehype pipeline (GFM enabled). MDX JSX is **not evaluated**; it is rendered as plain markdown.
- `src/lib/frontmatter.ts` — minimal YAML frontmatter parser (avoids gray-matter's eval in Workers).

## Code style (Biome)

- Indent: **tabs**
- Line width: **140**
- Quotes: **single** in JS, **double** in JSX
- Trailing commas: **all**
- Astro files (`.astro`) are **excluded** from Biome lint/format/assist.
- Import organize groups: `cloudflare:`, packages, blank line, `@/**`, blank line, relative paths.

## Testing & verification

- There are **no automated tests** in this repo. Verify by:
  1. `pnpm lint`
  2. `pnpm typecheck`
  3. `pnpm build`
  4. `pnpm preview` (requires `.dev.vars` and a reachable S3 endpoint for full verification)
