# Project setup: version currency, preflight, first boot

Read this when standing up a **brand-new** EmDash + Astro + Cloudflare project,
before the first `wrangler deploy`.

## Version currency — **every new EmDash project** (mandatory)

Do **not** copy `emdash` / `@emdash-cms/cloudflare` versions from the last repo by habit. New sites start on **latest stable**; upgrades research what shipped since the last project's baseline.

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
| Default / "new site" | Pin **latest stable**, include delta summary in plan, **propose** which new capabilities to use |
| "Full autonomy" / "ship it" | Pin latest, **adopt** low-risk upgrades (security, toolbar client mode if public cache, WP import improvements if migrating), implement obvious wins, store outcome in AutoMem, patch skills if patterns changed |
| "Stay on X" | Honor pin; still document latest and deferred delta |

After a successful first deploy on a new baseline, store AutoMem:

> `EmDash CMS baseline <to_version> on <project>. Adopted: … Deferred: …`
> tags: `emdash`, `decision`, `<project-slug>`

### 5. Skill hygiene

When a release changes deploy/seed/admin contracts this skill assumes, **update this SKILL.md** (and `building-emdash-site` if build APIs moved) in the same session — version bump `metadata.version`, drop stale "latest is 0.19" style claims, sync to skillissue package if published there.

### Snapshot (update when you change the ritual, not every release)

As of 2026-07-20 research: **npm latest `emdash@0.29.0`** / `@emdash-cms/cloudflare@0.29.0`. House projects were mostly on `^0.27.0` (SAO on `^0.19.0`). Notable since 0.27: chunked WP import on Workers (0.28), richer WP taxonomy/SEO/ACF import, admin `Cache-Control: private`, plugin route CSRF fix (0.28.1), content references API, search pagination, `toolbar: "client"`, taxonomies on MCP content writes, hreflang helpers (0.29).

## Preflight (do FIRST — these are account-level traps, not code bugs)

1. **R2 enabled?** `curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets` → `10042` means open the dashboard → R2 → **Enable** (free tier; needs a card on file). Cannot be scripted — hand it to the human.
2. **D1 capacity.** Free tier caps at **10 databases**. Count before creating; delete an unused (0-table) one if full.
3. **Token scope.** The deploy token needs **Workers Scripts:Edit + R2:Edit + Workers Routes:Edit + zone DNS:Edit**. wrangler's stored OAuth/account token often lacks R2 (`Authentication error 10000`) — export a scoped `CLOUDFLARE_API_TOKEN` for all commands.
4. **Zone.** The custom domain must live on a Cloudflare zone you control; grab its `zone_id`. (Attaching the domain itself is in `references/domain-dns.md`.)

## First boot + admin (the one manual step)

On the first request EmDash **auto-runs its D1 migrations and seeds** from `seed/seed.json`. Until the **setup wizard** is completed, every route redirects to `/_emdash/admin/setup`. The first admin login is created there **in a browser — a human-owned credential; do not automate it.**

**Critical:** any content page with `export const prerender = true` is frozen at *build* time. If you built before setup, EmDash baked a setup-redirect into each static page and it will keep redirecting even after setup. Content pages on a CMS site should be **SSR (omit `prerender`)** so the configured worker renders them live — like `/blog`. After setup, confirm a deep page renders; if it still redirects, drop `prerender` and redeploy.
