# Deploy: recipe and CI auto-deploy

Read this when doing the first deploy or a redeploy of an EmDash/Astro Worker.
Domain attachment is a separate step — see `references/domain-dns.md`.

## Recipe

The repo already ships `wrangler.jsonc` (`main: ./src/worker.ts`, `compatibility_flags: [nodejs_compat]`, `d1_databases` binding `DB`, `r2_buckets` binding `MEDIA`) and `astro.config.mjs` with `adapter: cloudflare()` + `emdash(...)`. Do **not** add `assets`/`SESSION` KV/`IMAGES` to wrangler.jsonc — the adapter auto-injects them into `dist/server/wrangler.json` at build.

```bash
export CLOUDFLARE_API_TOKEN=...   # scoped token (see references/project-setup.md Preflight #3)
export CLOUDFLARE_ACCOUNT_ID=...

# 1. Resources (D1 may already exist; wrangler auto-provisions the SESSION KV on deploy)
wrangler d1 create <site>-cms            # only if it does not exist
wrangler r2 bucket create <site>-media
# Preview D1+KV pairs, D1 migrations, and prod/preview sync are owned by the `cloudflare-ops` skill.

# 2. Build, then validate the bundle/bindings BEFORE deploying
npm install && npm run build
wrangler deploy --dry-run                # confirms ASSETS + SESSION + DB + MEDIA + IMAGES resolve

# 3. Deploy (creates the Worker; auto-provisions SESSION KV)
wrangler deploy                          # → https://<site>.<account-subdomain>.workers.dev

# 4. Encryption key (recommended; set after the Worker exists)
npx emdash secrets generate | tail -1 | wrangler secret put EMDASH_ENCRYPTION_KEY
```

For attaching a custom domain to the deployed Worker (step 5 of the original recipe), see `references/domain-dns.md`.

## Auto-deploy on merge (optional, but usually expected)

`wrangler deploy` is **manual** — a Worker has **no git-deploy by default**, so merging a PR does **not** redeploy (the live Worker silently drifts behind `main`). To wire merge→deploy, add `.github/workflows/deploy.yml`: on push to `main`, `npm ci → npm run build → npx wrangler deploy`, with repo secrets `CLOUDFLARE_API_TOKEN` (scope per Preflight #3 — include **Workers KV:Edit** so the adapter can auto-provision `SESSION`) and `CLOUDFLARE_ACCOUNT_ID`. The build runs clean without a local `.env` (runtime secrets live in Cloudflare and persist across deploys). Pin current action majors — **`actions/checkout@v6` + `actions/setup-node@v6`** (both run on the **node24** action runtime) with **`node-version: 24`** for the build. `@v4` runs the actions on Node 20, which GitHub force-migrated to Node 24 on 2026-06-16 and removes from runners on 2026-09-16 — note the deprecation warning is about the *action runtime*, independent of your `node-version` build input. Do **not** wire a Pages / GitHub-Pages git integration for an EmDash/Workers site — Pages can't run the Workers bundle, and GitHub Pages Jekyll-fails on `.astro` (see `references/troubleshooting.md`).
