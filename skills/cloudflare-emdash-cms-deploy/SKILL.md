---
name: cloudflare-emdash-cms-deploy
description: Use when deploying an Astro + EmDash CMS site to Cloudflare — build downloads wrangler.jsonc / 404s at root, setup-redirect loops, blank CMS content, new collections, or D1+R2 admin setup. Deploys to Workers, not Pages.
license: MIT
tags: [cloudflare, workers, emdash, astro, cms, d1, r2, deployment, autohub]
agents: [claude-code, codex, autojack]
category: deployment
metadata:
  version: "1.13.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Node, Read, Edit]
resources:
  - path: references/project-setup.md
    type: file
  - path: references/deploy.md
    type: file
  - path: references/domain-dns.md
    type: file
  - path: references/cms-configuration.md
    type: file
  - path: references/branding.md
    type: file
  - path: references/troubleshooting.md
    type: file
---

# Deploy Astro + EmDash CMS to Cloudflare Workers

## Overview

EmDash (the Astro-based CMS) deploys to **Cloudflare Workers, not Pages**. `@astrojs/cloudflare` v13+ is Workers-only: `astro build` emits `dist/client` + `dist/server` with **no `_worker.js`**. A Cloudflare **Pages** project cannot run that output, so it serves the raw repo — the root URL **downloads `wrangler.jsonc`** (`application/octet-stream`) or **404s** (no `index.html`). The fix is always: deploy as a Worker.

### Repo + package identity (do not confuse)

| Thing | What it is |
|---|---|
| **CMS** | GitHub [`emdash-cms/emdash`](https://github.com/emdash-cms/emdash) · npm `emdash` + `@emdash-cms/*` |
| **Not this** | [`generalaction/emdash`](https://github.com/generalaction/emdash) (agentic IDE on emdash.ai) — different product |

Ignore npm `emdash@1.0.0` as "current": it is an older April publish; **`npm view emdash version`** is the source of truth for stable CMS releases (tags look like `emdash@0.29.0` on GitHub).

## Deployment-correctness constraint (hard rule — read before touching wrangler)

Jack's standing rule for Cloudflare Pages: a project connected to GitHub (`source.type == "github"`) is deployed by **pushing to the connected repo**, never by running `wrangler pages deploy` — a direct upload against a GitHub-connected project bypasses CI and produces split-brain deploys where the dashboard and git disagree.

This skill's corollary is stricter: **EmDash cannot run on Pages at all** (see Overview above), so the question of "push vs. direct-upload" never even applies to Pages for this stack — the answer is always a Worker. A Worker has **no** git-deploy by default either; `wrangler deploy` is a manual, explicit action unless you wire your own CI (`references/deploy.md` → Auto-deploy on merge). If you ever catch yourself about to run `wrangler pages deploy` against an EmDash repo, stop — that repo does not belong on Pages, full stop.

## What are you trying to do?

- **Stand up a brand-new EmDash project** (resolve latest version, account preflight, first deploy, admin setup wizard) → `references/project-setup.md`
- **Deploy or redeploy the Worker** (recipe, wrangler commands, wiring CI auto-deploy) → `references/deploy.md`
- **Attach a custom domain** to an already-deployed Worker → `references/domain-dns.md`
- **Configure CMS content** (rendering model, adding a collection to a live site, menus/widgets/scheduled publishing, custom API routes, a plugin needing direct D1 access) → `references/cms-configuration.md`
- **Brand / white-label** the site (admin chrome, system emails, client-demo "Studio" branding, public SEO) → `references/branding.md`
- **Something's broken** (symptom → diagnosis, common mistakes table, verify commands, a real-world case study) → `references/troubleshooting.md`

## Quick preflight (before any deploy)

1. R2 must be **enabled** on the account (dashboard-only, needs a card on file) — `10042` errors mean it isn't.
2. D1 free tier caps at **10 databases** — check capacity before creating one.
3. Export a **scoped `CLOUDFLARE_API_TOKEN`** — wrangler's stored OAuth token often lacks R2 scope.
4. The custom domain's zone must be one you control (grab its `zone_id`).

Full detail, including the version-currency ritual that must run on every new project: `references/project-setup.md`.

## References

- `references/project-setup.md` — version resolution/pinning ritual, account preflight (R2/D1/token/zone), first-boot admin setup wizard and the prerender-before-setup trap.
- `references/deploy.md` — the deploy recipe (D1/R2 provisioning, build, dry-run, `wrangler deploy`, encryption key), and wiring GitHub Actions auto-deploy on merge.
- `references/domain-dns.md` — attaching a custom domain to a deployed Worker via the Cloudflare API.
- `references/cms-configuration.md` — entry-envelope rendering model, adding a 2nd/3rd content collection to a live site, menus/widgets/scheduled publishing, custom API routes and typed feeds, a plugin reading a custom D1 table.
- `references/branding.md` — site-identity D1 option vs. build-time admin config (two different knobs), rebranding system emails via `email:deliver`, client-demo white-labeling, public SEO.
- `references/troubleshooting.md` — symptom → diagnosis table, verify commands, the full common-mistakes table, and a real-world migration case study.
