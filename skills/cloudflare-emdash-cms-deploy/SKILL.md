---
name: cloudflare-emdash-cms-deploy
description: Use when deploying an Astro + EmDash CMS site to Cloudflare, when a site serves raw source / downloads wrangler.jsonc / 404s at the root after an Astro migration, when every page redirects to /_emdash/admin/setup even after setup is complete, when CMS posts render with an empty title/body, when an admin preview link 404s, when adding a custom API route/contact form to an EmDash/Astro worker, when adding a second/new content collection to an already-live EmDash site (schema create/add-field), or when standing up EmDash with D1 + R2 and an admin login. EmDash/Astro deploys to Cloudflare Workers, NOT Pages.
license: MIT
tags: [cloudflare, workers, emdash, astro, cms, d1, r2, deployment, autohub]
agents: [claude-code, codex, autojack]
category: deployment
metadata:
  version: "1.12.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Node, Read, Edit]
---

# Deploy Astro + EmDash CMS to Cloudflare Workers

## Overview

EmDash (the Astro-based CMS) deploys to **Cloudflare Workers, not Pages**. `@astrojs/cloudflare` v13+ is Workers-only: `astro build` emits `dist/client` + `dist/server` with **no `_worker.js`**. A Cloudflare **Pages** project cannot run that output, so it serves the raw repo — the root URL **downloads `wrangler.jsonc`** (`application/octet-stream`) or **404s** (no `index.html`). The fix is always: deploy as a Worker.

### Repo + package identity (do not confuse)

| Thing | What it is |
|---|---|
| **CMS** | GitHub [`emdash-cms/emdash`](https://github.com/emdash-cms/emdash) · npm `emdash` + `@emdash-cms/*` |
| **Not this** | [`generalaction/emdash`](https://github.com/generalaction/emdash) (agentic IDE on emdash.ai) — different product |

Ignore npm `emdash@1.0.0` as “current”: it is an older April publish; **`npm view emdash version`** is the source of truth for stable CMS releases (tags look like `emdash@0.29.0` on GitHub).

## Version currency — **every new EmDash project** (mandatory)

Do **not** copy `emdash` / `@emdash-cms/cloudflare` versions from the last repo by habit. New sites start on **latest stable**; upgrades research what shipped since the last project’s baseline.

### 1. Resolve latest (run every time)

```bash
# Stable CMS line (authoritative)
npm view emdash version
npm view @emdash-cms/cloudflare version
npm view emdash dist-tags   # ignore canary/next unless the user opts in

# GitHub release notes (same monorepo tags: emdash@X.Y.Z)
gh release list -R emdash-cms/emdash --limit 12
```

Pin new `package.json` deps to that resolved pair (keep `emdash` and `@emdash-cms/cloudflare` **in lockstep** — same minor). Prefer `^X.Y.Z` of current stable, not a hard-coded skill example.

### 2. Baseline from memory + last projects

```bash
# What we last shipped
# AutoMem: query "EmDash version" tags emdash / memberfix / southandozarks / automem-website
# Local package.json survey:
for p in memberfix-site skillissue/blog southandozarks automem-website; do
  node -e "const d=require('./$p/package.json').dependencies||{}; console.log('$p', d.emdash, d['@emdash-cms/cloudflare'])"
done 2>/dev/null
```

Record `from_version` (max baseline among related projects or memory) and `to_version` (npm latest).

### 3. Delta research (when `from < to`)

```bash
# Release bodies for each tag between from and to (example 0.27 → 0.29)
for t in emdash@0.28.0 emdash@0.28.1 emdash@0.29.0; do
  gh release view "$t" -R emdash-cms/emdash --json name,publishedAt,body \
    --jq '"\(.name) \(.publishedAt)\n\(.body[0:2000])\n---"'
done
```

Summarize for the user (or Autopilot log):

- **Breaking / migration** — config renames, seed shape, env vars, Worker limits  
- **New capabilities** worth adopting on this site (toolbar modes, WP import, references API, search pagination, taxonomies on MCP writes, …)  
- **Security fixes** that make upgrade non-optional (e.g. admin cache, plugin route CSRF)  
- **Skip / later** — features irrelevant to this build  

Write the summary under `docs/emdash-version-delta.md` in the new repo (short: from→to, bullets, decide/adopt/defer).

### 4. Autonomy modes

| User intent | Action |
|---|---|
| Default / “new site” | Pin **latest stable**, include delta summary in plan, **propose** which new capabilities to use |
| “Full autonomy” / “ship it” | Pin latest, **adopt** low-risk upgrades (security, toolbar client mode if public cache, WP import improvements if migrating), implement obvious wins, store outcome in AutoMem, patch skills if patterns changed |
| “Stay on X” | Honor pin; still document latest and deferred delta |

After a successful first deploy on a new baseline, store AutoMem:

> `EmDash CMS baseline <to_version> on <project>. Adopted: … Deferred: …`  
> tags: `emdash`, `decision`, `<project-slug>`

### 5. Skill hygiene

When a release changes deploy/seed/admin contracts this skill assumes, **update this SKILL.md** (and `building-emdash-site` if build APIs moved) in the same session — version bump `metadata.version`, drop stale “latest is 0.19” style claims, sync to skillissue package if published there.

### Snapshot (update when you change the ritual, not every release)

As of 2026-07-20 research: **npm latest `emdash@0.29.0`** / `@emdash-cms/cloudflare@0.29.0`. House projects were mostly on `^0.27.0` (SAO on `^0.19.0`). Notable since 0.27: chunked WP import on Workers (0.28), richer WP taxonomy/SEO/ACF import, admin `Cache-Control: private`, plugin route CSRF fix (0.28.1), content references API, search pagination, `toolbar: "client"`, taxonomies on MCP content writes, hreflang helpers (0.29).

## Symptom → diagnosis

- Root URL prompts to **download a text file** / `/wrangler.jsonc` returns `application/octet-stream` → the Pages project has **no build step** and is serving raw source. It needs a Worker, not Pages.
- `/` 404s on a fresh deploy but worked before → a static→Astro migration with stale Pages build config (`build_command: ''`, output dir = repo root).
- **Every page redirects to `/_emdash/admin/setup` even after setup is complete** (D1 `options` shows `emdash:setup_complete = true`, `users` > 0) → prerendered pages were built before setup and froze a redirect (see Common mistakes: prerender-before-setup).
- **CMS posts render with an empty title/body (only the slug/URL works)** → `getEmDashCollection`/`getEmDashEntry` return an **entry envelope** `{ id, slug, status, data, … }`; the fields live under `.data`. Read `entry.data.title`, not `entry.title` (see Rendering CMS content).
- **An admin "preview"/"view on site" link 404s** → the collection's `url_pattern` is null, so EmDash defaults to `/<collection>/{slug}` (e.g. `/posts/...`). Set `url_pattern` to your real route, e.g. `/blog/{slug}`.
- **A custom API route returns an empty HTTP 500** → `Astro.locals.runtime.env has been removed in Astro v6`; use `import { env } from "cloudflare:workers"` (see Adding custom endpoints).
- Deploy fails `code 10042 Please enable R2` → R2 not enabled on the account (see Preflight).
- Agent blocks mid-build "which D1 can I delete?" → account is at the 10-database D1 free-tier cap.
- **A GitHub `pages build and deployment` check fails on every push** (Jekyll errors: `Invalid YAML front matter in .../about.astro`, `YAML Exception reading .../*.astro`) → **vestigial GitHub Pages**, not Cloudflare. GitHub Pages was left enabled (legacy/Jekyll mode) and Jekyll-builds the `.astro` source on each push, choking on the `---` frontmatter fences. It is unrelated to the live Worker. Confirm with `gh api repos/<owner>/<repo>/pages` (`status: errored`, `build_type: legacy`); fix by disabling it — `gh api -X DELETE repos/<owner>/<repo>/pages` (see Auto-deploy on merge).

## Preflight (do FIRST — these are account-level traps, not code bugs)

1. **R2 enabled?** `curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets` → `10042` means open the dashboard → R2 → **Enable** (free tier; needs a card on file). Cannot be scripted — hand it to the human.
2. **D1 capacity.** Free tier caps at **10 databases**. Count before creating; delete an unused (0-table) one if full.
3. **Token scope.** The deploy token needs **Workers Scripts:Edit + R2:Edit + Workers Routes:Edit + zone DNS:Edit**. wrangler's stored OAuth/account token often lacks R2 (`Authentication error 10000`) — export a scoped `CLOUDFLARE_API_TOKEN` for all commands.
4. **Zone.** The custom domain must live on a Cloudflare zone you control; grab its `zone_id`.

## Recipe

The repo already ships `wrangler.jsonc` (`main: ./src/worker.ts`, `compatibility_flags: [nodejs_compat]`, `d1_databases` binding `DB`, `r2_buckets` binding `MEDIA`) and `astro.config.mjs` with `adapter: cloudflare()` + `emdash(...)`. Do **not** add `assets`/`SESSION` KV/`IMAGES` to wrangler.jsonc — the adapter auto-injects them into `dist/server/wrangler.json` at build.

```bash
export CLOUDFLARE_API_TOKEN=...   # scoped token (Preflight #3)
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

# 5. Custom domain on a Worker (API; wrangler routes also work)
curl -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/domains" \
  -d '{"environment":"production","hostname":"<site>.<zone>","service":"<site>","zone_id":"<zone_id>"}'
```

## Auto-deploy on merge (optional, but usually expected)

`wrangler deploy` is **manual** — a Worker has **no git-deploy by default**, so merging a PR does **not** redeploy (the live Worker silently drifts behind `main`). To wire merge→deploy, add `.github/workflows/deploy.yml`: on push to `main`, `npm ci → npm run build → npx wrangler deploy`, with repo secrets `CLOUDFLARE_API_TOKEN` (scope per Preflight #3 — include **Workers KV:Edit** so the adapter can auto-provision `SESSION`) and `CLOUDFLARE_ACCOUNT_ID`. The build runs clean without a local `.env` (runtime secrets live in Cloudflare and persist across deploys). Pin current action majors — **`actions/checkout@v6` + `actions/setup-node@v6`** (both run on the **node24** action runtime) with **`node-version: 24`** for the build. `@v4` runs the actions on Node 20, which GitHub force-migrated to Node 24 on 2026-06-16 and removes from runners on 2026-09-16 — note the deprecation warning is about the *action runtime*, independent of your `node-version` build input. Do **not** wire a Pages / GitHub-Pages git integration for an EmDash/Workers site — Pages can't run the Workers bundle, and GitHub Pages Jekyll-fails on `.astro` (see Symptom → diagnosis).

## First boot + admin (the one manual step)

On the first request EmDash **auto-runs its D1 migrations and seeds** from `seed/seed.json`. Until the **setup wizard** is completed, every route redirects to `/_emdash/admin/setup`. The first admin login is created there **in a browser — a human-owned credential; do not automate it.**

**Critical:** any content page with `export const prerender = true` is frozen at *build* time. If you built before setup, EmDash baked a setup-redirect into each static page and it will keep redirecting even after setup. Content pages on a CMS site should be **SSR (omit `prerender`)** so the configured worker renders them live — like `/blog`. After setup, confirm a deep page renders; if it still redirects, drop `prerender` and redeploy.

## Rendering CMS content (deploy-time symptoms)

Two rendering bugs commonly surface right after a deploy — they live here because that's *when* you hit them, but the full rendering model (entry envelopes, `<Image>` with no `.src`, `Astro.cache`/`cacheHint`) is owned by the **`building-emdash-site`** skill. Read that for the model; use the two symptom rows below to unblock a deploy.

- **Blank post (title/body empty but the slug/URL works):** `getEmDashCollection`/`getEmDashEntry` (from `emdash`) return an **entry envelope** `{ id, slug, status, data, cacheHint, edit }` — the field values are under **`.data`**. Read `entry.data.title`, not `entry.title` (unwrap once with `const posts = entries.map(e => e.data ?? e)`). Reading the envelope directly renders empty while the link still works, which masquerades as a CMS/data bug but is a template bug.
- **Admin "preview" / permalink 404s:** the collection's **`url_pattern`** is null, so EmDash defaults to `/<collection>/{slug}` (e.g. `/posts/...`). Set it to your real route (e.g. `/blog/{slug}`, placeholders `{slug}`/`{id}`) in `seed/seed.json` *and* the live `_emdash_collections` row.

## Adding a new collection to a live site (a 2nd content type)

`seed/seed.json` applies on **first boot only** (or an explicit `emdash seed`) — it will **not** retro-add a collection to an already-seeded live DB. To add a second content type (e.g. `events` alongside `posts`) to a running site, provision it on the live DB with the **EmDash CLI**, then ship the templates:

```bash
export EMDASH_TOKEN=$(grep '^EMDASH_TOKEN=' .env | cut -d= -f2-)
ec() { node node_modules/emdash/dist/cli/index.mjs "$@"; }   # or: npx emdash
URL=https://<site>.<zone>

ec schema create events --label "Events" --label-singular "Event" --url "$URL"
ec schema add-field events title      --type string       --label "Title" --required --url "$URL"
ec schema add-field events event_date --type datetime     --label "Start" --required --url "$URL"
ec schema add-field events location   --type string       --label "Location"          --url "$URL"
ec schema add-field events description --type portableText --label "Description"        --url "$URL"
#   field types: string text number integer boolean datetime image reference portableText json
ec content create events --file ev.json --slug <slug> --url "$URL"   # auto-publishes
```

Gotchas, in the order they bite:

- **`schema create` makes an EMPTY collection** — no implicit `title`. Add every field (including `title`) via `add-field`.
- **`url_pattern` defaults to `/<collection>/{slug}`.** A collection named `events` with routes at `src/pages/events/[slug].astro` needs **no** override — admin preview/permalinks resolve out of the box. (Contrast `posts` → `/blog/{slug}`, which *does* need the override; see Rendering CMS content.)
- **Provision the collection in the live DB BEFORE deploying templates that call `getEmDashCollection('<slug>')`.** `astro build` does **not** execute SSR pages, so the build passes even when the collection doesn't exist yet — the failure surfaces only at runtime as a 500. Create the schema first, then `wrangler deploy`.
- **`datetime` field validator is `z.string().datetime().or(z.string().date())`** — accepts ISO-with-`Z` (`2026-08-09T15:30:00.000Z`) **or** a bare `YYYY-MM-DD`, and **rejects `±HH:MM` offsets** (`...-05:00` → `event_date: Invalid input`). Store UTC `Z`; format for display in the page (`toLocaleString('en-US', { timeZone: 'America/Chicago' })`), and render bare all-day dates with `timeZone: 'UTC'` so the day doesn't slip backward when the worker runs in UTC. **For content spanning timezones, don't hardcode one display zone** — add a per-record IANA `timezone` string field (e.g. `America/Phoenix`), format with `timeZone: data.timezone || '<default>'`, and pass `timeZoneName: 'short'` so the abbreviation shows (`11:00 AM MST` vs `9:00 AM CDT`) and removes the ambiguity.
- **Don't `orderBy` a custom field.** `getEmDashCollection`'s `orderBy` is reliable for system columns (`published_at`); a custom field like `event_date` isn't guaranteed orderable. Fetch with a generous `limit` and sort/split in JS.
- **portableText fields auto-convert markdown.** Pass `description` to `content create` as a markdown **string** → EmDash stores PT; the render path (and `content get --raw`) returns the **PT array** for `<PortableText value={data.description}>`, while a plain `content get` shows the round-trip markdown source (looks like "it didn't convert" — it did). Pass an **array** to send raw PT (custom blocks).
- **Mirror the collection into `seed/seed.json`** (collection def + a sample item) for fresh-install parity, even though it won't auto-apply to the live DB.
- **Route-scoped CSS:** copy the `blog.css` + `BlogHead.astro` pattern — a `public/<name>.css` injected via the Layout `head` slot on those routes only. A plain linked stylesheet **cannot** use Astro `:global(...)`; that's scoped-`<style>`-only syntax and browsers silently drop the rule.

## Menus, widgets & scheduled publishing (live-provision, like collections)

Like a 2nd collection: provision the **live** D1/config first, deploy the template that reads it, then mirror into `seed/seed.json` (seed only seeds *fresh* installs — it never touches the existing live DB).

- **Live menu — `ec menu` has only `list`/`get`, NO `create`.** Insert directly (or use the admin UI). `getMenu('primary')` returns `Menu { items: MenuItem[] }` with nested **`children: MenuItem[]`**; `MenuItem.url` comes from `custom_url` for `type='custom'`. Tables: `_emdash_menus(id TEXT pk, name, label, locale='en', …)`, `_emdash_menu_items(id TEXT pk, menu_id, parent_id, sort_order, type, custom_url, label, css_classes, target, …)` — a non-null `parent_id` makes a dropdown child.
  ```bash
  npx wrangler d1 execute <db> --remote --command "
   INSERT INTO _emdash_menus (id,name,label,locale) VALUES ('menu-primary','primary','Primary Navigation','en');
   INSERT INTO _emdash_menu_items (id,menu_id,parent_id,sort_order,type,custom_url,label,css_classes) VALUES
    ('mi-home','menu-primary',NULL,0,'custom','/','Home',NULL),
    ('mi-ch','menu-primary',NULL,2,'custom','/churches','Churches',NULL),
    ('mi-ch-al','menu-primary','mi-ch',0,'custom','/churches#alabama','Alabama',NULL);"
  ```
  `SeedMenuItem` supports `children?: SeedMenuItem[]` — nest dropdowns in the seed too, or seed/live drift (count `items` recursively, not just top-level).
- **Footer widget area:** `getWidgetArea('footer')` → `{ widgets: Widget[] }` (`type` ∈ content|menu|component). Live tables `_emdash_widget_areas` / `_emdash_widgets`; seed shape `widgetAreas:[{name,label,widgets:[…]}]`. Guard null in the template (`area?.widgets ?? []`).
- **Scheduled publishing needs `triggers.crons`.** `@emdash-cms/cloudflare/worker` ships a `scheduled()` handler, but nothing runs it without `"triggers": { "crons": ["*/15 * * * *"] }` in `wrangler.jsonc`. `ec content schedule <coll> <id> --at <ISO-Z>` → status `scheduled`; the sweep publishes on the next cron tick past that time (UTC `Z` only).

## Rendering & CSS-scoping gotchas (homepage / structured pages → CMS)

- **`getEmDashEntry(type,id)` returns `{ entry, cacheHint }`** — fields under `entry.data`, click-to-edit spreads under `entry.edit` (NOT the bare envelope). Destructure: `const { entry, cacheHint } = await getEmDashEntry('homepage','home')`. For a singleton-style page, model it as a one-entry collection queried by a fixed slug (`'home'`); there is no native singleton.
- **Page CSS appended to a shared `style.css` can redefine global element-classes** (e.g. `.btn`, `.btn-ghost`) and silently restyle every other page. Scope page-specific rules to a wrapper/prefix (`.fp-btn*`, `.frontispiece .x`). A single-page screenshot won't catch the cross-page regression — verify the other pages too.
- **A plugin needs the *native* format for direct D1 access.** A standard/sandboxed plugin's `ctx` exposes only `ctx.content` (EmDash collections) + scoped `ctx.storage`/`ctx.kv` — it can't read a raw custom D1 table (e.g. `contact_messages`).

## Adding custom endpoints (forms, APIs)

To add a server route (contact form, webhook, JSON API) to an EmDash/Astro worker:

- Create `src/pages/api/<name>.ts` exporting `GET`/`POST`, with `export const prerender = false`.
- Access bindings via `import { env } from "cloudflare:workers"`. **Astro 6 removed `Astro.locals.runtime.env`** — using it throws `...has been removed in Astro v6`, which surfaces as an **empty HTTP 500** (not your JSON error path). `env.DB` (D1), `env.<SECRET>` (Worker secrets via `wrangler secret put`), `env.<VAR>` (non-secret `vars` in wrangler.jsonc).
- For a contact form / lead capture (D1 + Resend), the full pattern is owned by **`cloudflare-lead-capture`** (its Astro SSR / Workers variant: D1-first, honeypot, send-only Resend key, `<ContactForm>`). This skill owns only the binding/runtime mechanics above (`cloudflare:workers` import, `prerender = false`) — don't re-derive the lead flow here.
- **Typed feeds/downloads from a collection** (`.ics`, RSS/XML, JSON) use Astro's **extension routing**: the filename's pre-`.ts` suffix becomes a literal path segment. `src/pages/events/[slug].ics.ts` serves `/events/<slug>.ics`; `src/pages/events/rss.xml.ts` serves `/events/rss.xml`. Each is a `prerender = false` endpoint exporting `GET` that calls `getEmDashEntry`/`getEmDashCollection` and returns a `new Response(body, { headers: { 'Content-Type': ... } })`. For `.ics`, flatten the Portable Text body to plain text and emit UTC `DTSTART`/`DTEND` (`VALUE=DATE` for all-day); for RSS, mirror the blog feed and use the collection's own date field as `<pubDate>`.

## EmDash's own emails + site identity (invites, sign-in, verify)

EmDash sends its auth emails (admin invite, magic-link sign-in, email verification) through the **email pipeline** to whatever plugin registers the exclusive `email:deliver` hook (e.g. a Resend transport). Two things you'll want to brand:

**1. The name in them.** Subjects/bodies read `siteName = options['emdash:site_title'] || "EmDash"`, so a fresh install literally emails "You've been invited to EmDash". There's **no CLI/admin route** to change it post-setup (only the setup wizard writes it) → write D1 directly. **Option values are JSON-encoded**, so store a *quoted* string:

```bash
wrangler d1 execute <db> --remote --command \
 "INSERT INTO options (name,value) VALUES ('emdash:site_title','\"Your Site Name\"') \
  ON CONFLICT(name) DO UPDATE SET value = excluded.value;"
```

Reads are per-request, so it's **live immediately, no deploy**. Same option also drives the passkey `rpName` (display-only — safe to change). This is the one-knob fix; do it before fussing with templates.

**2. The look of them.** Rebrand in the **`email:deliver` transport handler**, *not* `email:beforeSend`. EmDash deliberately **bypasses** `email:beforeSend`/`email:afterSend` for `source === 'system'` (see `EmailPipeline.sendInner`: `isSystemEmail` short-circuits straight to the exclusive deliver hook). A `beforeSend` hook registers without error and simply **never fires for auth emails** — you'll watch the subject change but the HTML stay default-blue. In the deliver handler you get `{ message, source }`; when `source === 'system'`, swap `message.html` for your branded shell (extract the action URL from the original HTML, keep `to`/`subject`/`text`), and **pass through unchanged** when you can't safely rebrand so delivery never breaks. The branded HTML is a hand-rolled table+inline-style string (mirrors EmDash's own auth templates); React-Email lives in the contact path, owned by `cloudflare-lead-capture`.

### Admin chrome branding / white-labeling (the "still says EmDash" question)

**Admin white-labeling is first-class — but it's a build-time config block, NOT a D1 option.** This is the trap: grepping the `options` table / the `siteInfo` middleware (which only reads `emdash:site_title`/`_site_url`/`_locale`) makes it look unconfigurable. It isn't. The knob lives in `astro.config.mjs`:

```js
emdash({
  database: d1({ ... }),
  storage: r2({ ... }),
  admin: {
    logo: "/diocese-mark.svg",      // image path/URL → admin sidebar + login (replaces the EmDash lockup)
    siteName: "South & Ozarks",     // sidebar header + footer + browser tab
    favicon: "/favicon.svg",        // admin-panel favicon
  },
})
```

How it flows: the integration serializes `config.admin` (`astro/index.mjs`) → the manifest route `/_emdash/api/manifest` returns `locals.emdash.config.admin` → the admin SPA's `BrandLogo` renders `manifest.admin.logo` (and falls back to the hardcoded EmDash lockup only when `logo` is unset). All three fields optional; needs a **rebuild + deploy** (build-time, not runtime). `admin.logo` requires an actual image asset in `public/` — `siteName` alone won't remove the EmDash *logo*, only its text.

**Two separate identity surfaces — don't conflate:**
- `emdash({ admin: {...} })` → the **admin panel** (sidebar/login/favicon). Build-time.
- `emdash:site_title` D1 option (+ public site settings) → **emails, public-site SEO, passkey rpName**. Runtime, per-request. (See the email section above.)

Admin `logo` / `siteName` / `favicon` have shipped since **0.19.0**. Always resolve current line with `npm view emdash version` (do **not** assume a number in this skill is latest). Ignore npm `emdash@1.0.0` as current — older publish. Further login-page white-labeling beyond logo/name/favicon is still limited upstream.

**Lesson:** for admin branding, look at the `config.admin` → `/_emdash/api/manifest` → SPA path, not D1 options. Two passes wrongly concluded "no knob" by inspecting only the options/siteInfo path.

### Client demos: white-label Studio (scare the WordPress operator)

When the audience is a WP agency / membership operator (e.g. MemberFix / Vic), **do not ship default EmDash chrome**. Treat admin white-label as part of the product pitch:

1. **Product name, not CMS name** — `siteName: "<Client> Studio"` (sidebar, login title, browser tab). Avoid leaving "EmDash" visible in the shell.
2. **Dark-friendly logo assets** — WP header PNGs often wash out on the admin SPA. Ship dedicated SVG:
   - `public/admin-lockup.svg` — horizontal mark + wordmark (+ optional accent pill) for login/sidebar (`object-fit: contain`)
   - `public/admin-mark.svg` — square favicon
   Point `admin.logo` / `admin.favicon` at those paths.
3. **D1 title matches** — after setup, set `emdash:site_title` to the same Studio string (JSON-quoted) so invites/passkey RP name don't say "EmDash".
4. **System emails match** — rebrand in `email:deliver` with the Studio name (see above).
5. **Public footer badge** — quiet flex: `"<Client> Studio · no WordPress runtime"` beats `"Powered by EmDash"`.
6. **Seed `meta.name` / `settings.title`** — setup wizard "Template: …" line should already say Studio, not the generic CMS.

Reference implementation: `verygoodplugins/memberfix-site` (`docs/admin-branding.md`, `public/admin-lockup.svg`). Rebuild+deploy after `admin.*` changes; D1 title is live without redeploy.

What you *cannot* theme yet (as of 0.29): admin CSS tokens / full login page layout beyond logo+name+favicon. Do the rest on the public site + email shell.

## Verify

```bash
# EmDash auth-email branding: send a real invite to a +tag you control, then read it back from the provider.
curl -sS -X POST "https://<site>.<zone>/_emdash/api/auth/invite" \
  -H "Authorization: Bearer $EMDASH_TOKEN" -H "content-type: application/json" \
  -d '{"email":"you+invite-test@gmail.com"}'                          # 200 {"data":{"success":true,...}}
resend emails list -q | ...                                          # subject shows your site_title, HTML carries your brand

curl -sI "https://<site>.<zone>/"                                   # 200; redirects to /_emdash/admin/setup pre-setup
curl -so /dev/null -w '%{http_code}\n' "https://<site>.<zone>/_emdash/admin/setup"   # 200 = wizard live
# AFTER setup: a content page must render its real title, not a 335-byte setup redirect:
curl -sL "https://<site>.<zone>/about?cb=$RANDOM" | grep -i '<title>'
# A CMS post must render its real title (proves entry.data is read correctly):
curl -sL "https://<site>.<zone>/blog/<post-slug>?cb=$RANDOM" | grep -i '<title>'
```

## Common mistakes

| Mistake | Reality |
|---|---|
| Deploying EmDash/Astro to Cloudflare **Pages** | `@astrojs/cloudflare` v13 is Workers-only; Pages serves raw source. Use `wrangler deploy`. |
| Declaring `assets`/`SESSION`/`IMAGES` in wrangler.jsonc | The adapter injects them at build; declaring by hand can conflict. Keep wrangler.jsonc minimal. |
| `prerender = true` on CMS content pages | Built before setup, EmDash bakes a `/_emdash/admin/setup` redirect into each static page; on Workers the static asset shadows the live worker, so pages keep redirecting post-setup. Make them SSR (omit prerender). |
| Reading `post.title` from getEmDashCollection/getEmDashEntry | Those return `{ id, slug, status, data, … }`; fields are under `.data`. Use `entry.data.title`/`entry.data.content`. Only `slug` is on the envelope, so the post renders empty while the link still works. |
| Leaving a collection's `url_pattern` null | Admin preview/permalink defaults to `/<collection>/{slug}`, which 404s when your route differs (e.g. `/blog/{slug}`). Set it in the seed + `_emdash_collections`. |
| `Astro.locals.runtime.env` in an endpoint | Removed in Astro 6 — throws an empty 500. Use `import { env } from "cloudflare:workers"`. |
| Skipping the R2/D1 preflight | Deploy dies on `10042` (R2 not enabled) or stalls at the 10-DB cap mid-run. Check enablement first. |
| Using wrangler's stored OAuth token | Often lacks R2 scope (`Authentication error 10000`). Export a scoped `CLOUDFLARE_API_TOKEN`. |
| Trying to script the admin setup | First admin is a browser wizard + a credential the owner must hold. Hand it off. |
| `wrangler pages deploy` on a git-connected Pages project | Split-brain deploys. For EmDash the answer is a Worker, not Pages at all. |
| Branding EmDash's system emails via `email:beforeSend` | `source==='system'` emails bypass beforeSend/afterSend entirely (`EmailPipeline.sendInner`) — the hook registers but never fires for invites. Rebrand in the exclusive `email:deliver` transport handler instead. |
| Writing `emdash:site_title` (or any option) as a raw string in D1 | Option values are JSON-encoded — store `'"Name"'` (quoted). A bare string makes `OptionsRepository.get` throw on `JSON.parse`. |
| Adding a 2nd collection by only editing `seed/seed.json` on a live site | The seed applies on first boot only. Provision the live DB with `emdash schema create` + `add-field`, then deploy the templates (and mirror into the seed for fresh installs). |
| Deploying `getEmDashCollection('<new>')` templates before the collection exists in the live DB | The build passes (SSR pages aren't executed at build) but the route 500s at runtime. Create the schema first, then `wrangler deploy`. |
| `orderBy` on a custom field in `getEmDashCollection` | Reliable only for system columns (`published_at`). Fetch with a `limit` and sort in JS for custom fields like `event_date`. |
| A `datetime` field value with a `±HH:MM` offset | The validator is `z.string().datetime().or(z.string().date())` — accepts `...Z` or bare `YYYY-MM-DD`, rejects offsets (`Invalid input`). Store UTC `Z`. |
| `:global(...)` in a plain linked `public/*.css` | Scoped-`<style>`-only syntax; browsers drop the rule. Use a normal selector in route stylesheets. |
| `getEmDashEntry` / `getEmDashCollection` return shape | Returns `{ entry, cacheHint }` (or array of envelopes); fields under `.data`, click-to-edit under `.edit`. (Not the envelope directly at root.) |
| `ec menu` create | No `ec menu create`; provision via `wrangler d1 execute --remote` INSERTs into `_emdash_menus` + `_emdash_menu_items` (id/parent_id/sort_order for nesting) or the admin UI. Mirror children in seed if supported. |
| Scheduled publishing | Worker re-exports `scheduled()` but it is never invoked unless `wrangler.jsonc` has `"triggers": { "crons": ["*/15 * * * *"] }`. Schedule posts with `ec content schedule ... --at <UTC-Z>`. |
| Schema field types via CLI | `schema add-field --type` supports only: string/text/number/integer/boolean/datetime/image/reference/portableText/json. No repeater/select/url/slug — use flat fields or finish modeling in admin UI. |
| Shared style.css + page-specific rules | Appending homepage styles can clobber global `.btn` etc. Scope page-specific buttons (`.fp-btn*`, `.hero .btn`). |
| EmDash plugins + direct D1 | Sandboxed plugins only see `ctx.content` + scoped storage. Direct D1 (e.g. contact_messages table) requires a **native** plugin (listed in project `plugins/`, full host context with DB binding). |

## Real-world impact

`southandozarks.org` diocese site: a static→Astro+EmDash migration left it on a Pages project serving raw source (root URL downloaded `wrangler.jsonc`). Re-deployed as a Worker at `southandozarks.autojack.ai` once R2 was enabled — all five bindings resolved on the first `wrangler deploy`. Post-setup, pages redirected to setup because they were prerendered before setup (fixed by dropping `prerender`). A contact form was added as `src/pages/api/contact.ts` (D1 + Resend) — the first cut 500'd on `locals.runtime.env` until switched to `import { env } from "cloudflare:workers"`. The seeded blog post rendered blank because the templates read `post.title` instead of `post.data.title`, and the admin preview 404'd because the collection `url_pattern` was null — both fixed. Later, branding the diocese's own admin invites needed two moves: set `emdash:site_title` in D1 (invites had said "You've been invited to EmDash") and rebrand the body in the `email:deliver` transport — a first cut put the rebrand in `email:beforeSend`, which silently no-op'd because system emails bypass that pipeline. Verified by sending a real invite and reading the delivered HTML back from Resend. Later still, a second content type — an `events` collection (Diocesan Calendar) — was added to the **already-live** site with `emdash schema create events` + seven `add-field` calls against the live URL, then `/events` + `/events/[slug]` SSR routes and a homepage "Upcoming" block were deployed; the collection had to be provisioned *before* deploy (the build passes without it, but the SSR route 500s at runtime), `event_date` had to be stored as UTC `Z` (a `-05:00` offset threw `Invalid input`), and the date list was sorted/split in JS because `orderBy` isn't dependable on a custom field. A follow-up pass added a third collection (`churches`, the same recipe — provisioned live, seeded, `/churches` + `/churches/[slug]` + the homepage preview wired to it as the single source of truth), wired the homepage's hardcoded news to the live `posts`, and hardened the calendar: a per-record IANA `timezone` field so events display in their own zone with the abbreviation shown (`11:00 AM MST` for a Tucson ordination vs `9:00 AM CDT` for a Branson synod), plus `.ics` download and RSS endpoints via Astro extension routing (`[slug].ics.ts`, `rss.xml.ts`).
