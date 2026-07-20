# skillissue essays (EmDash hybrid)

Astro + EmDash **Worker** for long-form essays. The skills catalog, install docs, and lead capture stay on **Cloudflare Pages** (repo root → `site/`).

```
skillissue.sh/              → Pages (static catalog)
skillissue.sh/essays/*      → Worker skillissue-blog (this package)
skillissue.sh/_emdash/*     → Worker admin + API
```

Patterns borrowed from:

- `automem-website` — `src/lib/emdash-figures` (SVG + Mermaid PT blocks)
- `southandozarks` — lean Worker layout, blog routes, wrangler shape
- skills: `building-emdash-site`, `cloudflare-emdash-cms-deploy`

## Local

```bash
cd blog
npm install
npm run seed:build          # content/essays/*.md + charts → seed/seed.json
npm run dev                 # http://localhost:4322
```

First boot: open `/_emdash/admin/setup` to create the admin user. Seed applies when the DB is empty.

> Dev needs D1/R2 via the Cloudflare adapter (Miniflare). If local DB bindings fail, use `wrangler dev` after build, or provision remote resources and point wrangler at them.

## Provision (once)

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...

# D1 free tier is capped — skillissue-leads already exists for Pages lead capture.
wrangler d1 create skillissue-cms
wrangler r2 bucket create skillissue-media

# Paste database_id into wrangler.jsonc (replace REPLACE_WITH_D1_ID)
```

R2 must be **enabled** on the account first (dashboard) or create fails with `10042`.

## Deploy

```bash
cd blog
npm run build
npx wrangler deploy --dry-run   # confirm ASSETS + DB + MEDIA + SESSION
npx wrangler deploy

# encryption key (after first deploy)
npx emdash secrets generate | tail -1 | npx wrangler secret put EMDASH_ENCRYPTION_KEY
```

### Zone routes (path hybrid)

Attach Worker routes so Pages keeps the rest of the host:

| Route | Owner |
|---|---|
| `skillissue.sh/essays` | skillissue-blog |
| `skillissue.sh/essays/*` | skillissue-blog |
| `skillissue.sh/_emdash/*` | skillissue-blog |
| everything else | Pages project `skillissue` |

**Alternative:** custom host `blog.skillissue.sh` → Worker only (no route split). Then update catalog essay links to that host.

### Do not

- Deploy this package with `wrangler pages deploy` / Pages git build
- Put EmDash on the existing Pages project (Workers-only; otherwise root serves wrangler JSON)
- Prerender CMS essay pages before admin setup (bakes setup redirects)

## Content

| Source | Role |
|---|---|
| `../content/essays/*.md` | Authoring SSOT for seed rebuild |
| `../content/assets/charts/*.svg` | Copied to `public/charts` + inlined as `figureSvg` blocks |
| EmDash admin | Day-to-day edits after go-live |

```bash
npm run seed:build   # re-run after essay/chart changes (fresh installs only)
```

Live DB does **not** re-seed on deploy. Use admin or `emdash content` CLI for updates.

## Deep post draft

`../content/drafts/drunk-support-inventory-is-not-context.md` stays for drunk.support / a second essay. To seed it later:

1. Move or copy into `../content/essays/`
2. Extend `scripts/build-seed.mjs` (or create in admin with figureSvg blocks)

## Related root scripts

- `npm run build` (repo root) — static catalog only
- `blog/npm run build` — EmDash Worker bundle
