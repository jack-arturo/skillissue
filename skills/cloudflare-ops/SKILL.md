---
name: cloudflare-ops
description: >-
  Use when the user asks to deploy an AutoHub-style project to Cloudflare, run
  Pages or Worker preflights, operate D1 migrations/sync, manage the local
  Cloudflare tunnel helper, standardize repo-local Cloudflare hacks, or add a
  simple DNS TXT/CNAME on a VGP zone (e.g. wpfusion.com Wordfence
  wfvendor=… verification). Assume CLOUDFLARE_API_TOKEN + ACCOUNT_ID are already
  in the shell / System Configuration secrets — do not ask Jack to paste Wrangler
  creds.
license: MIT
tags: [cloudflare, ops, pages, workers, d1, kv, tunnel, dns, autovault, autohub]
agents: [claude-code, codex, autojack, cursor]
category: deployment
metadata:
  version: "1.0.5"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Node, Read, Edit]
requires-secrets: []
resources:
  - path: bin/cloudflare-ops
    type: file
bin:
  run:
    command: bin/cloudflare-ops
    description: Signed wrapper that dispatches Cloudflare ops tasks (deploy-pages, setup-d1, setup-d1-preview, tunnel-setup, tunnel-start, migrate, sync) for the target repo.
    requires-tty: false
---

# Cloudflare Ops

## When To Use

Use this skill when the user asks to deploy an AutoHub-style project to
Cloudflare, run Pages or Worker preflights, operate D1 migrations/sync, manage
the local Cloudflare tunnel helper, pair preview D1+KV resources for safe PR
previews, or standardize repo-local Cloudflare hacks.

For full one-shot Clerk + Stripe + Cloudflare commerce builds, drive this skill
from `clerk-cloudflare-commerce-bootstrap`. For per-environment Pages env vars
and DNS/registrar work, see `cloudflare-commerce-deploy`.

This skill's deploy path is **Pages-centric**. For an Astro/EmDash site that runs
as a **Worker** (`output: 'server'` + `@astrojs/cloudflare`, shipped with
`wrangler deploy` — *not* Pages), the deploy recipe and its gotchas are owned by
`cloudflare-emdash-cms-deploy`. Use *this* skill for that project's D1/KV
provisioning, preview pairs, migrations, and sync.

## Deploy Mechanism — choose one canonical path

Cloudflare Pages supports two healthy deployment models. Detect which model the
project already uses and preserve it unless the user explicitly asks to switch.

- **Git-connected Pages:** `source.type == "github"` in the Pages project.
  Ongoing deploys happen from `git push` and Cloudflare's Git integration. In
  this model, do not run ad hoc local `wrangler pages deploy` for ongoing
  releases because it bypasses the connected build path.
- **Direct Upload from CI:** the repo owns a GitHub Actions workflow that runs
  `wrangler pages deploy` with a commit hash/branch after tests and builds pass.
  This is valid when it is the canonical CI path; keep using the workflow and do
  not forcibly connect the Pages project to GitHub.

The `deploy-pages` task in this skill is a setup/bootstrap helper. It can create
the Pages project and attach domains. It should only connect the project to
GitHub when the chosen deployment model is Git-connected Pages.

### Connect a Pages project to a GitHub repo

After the project is created and domains are attached, wire it to the repo
with one POST:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/<project_name>" \
  --data '{
    "source": {
      "type": "github",
      "config": {
        "owner": "<github_org_or_user>",
        "repo_name": "<repo>",
        "production_branch": "main"
      }
    }
  }'
```

Verify with `GET …/pages/projects/<project_name>` and confirm
`result.source.type == "github"` and the `config.{owner,repo_name,production_branch}`
match.

For a Direct Upload project, verify the workflow instead: it should checkout the
exact commit, run the repo's build/test gate, then call `wrangler pages deploy`
with `--project-name`, `--branch`, and `--commit-hash`. Do not add a second
Cloudflare auto-build path on top of that workflow.

## Preconditions

- The target repo is passed with `--repo <path>` for Pages/D1/tunnel tasks.
- Wrangler/cloudflared credentials stay outside chat and source control.
- If global Wrangler auth is already configured (`wrangler login` state and/or
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` from shell startup / Autohub
  `.env` / System Configuration `secrets/.env`), treat that as the default
  credential path for all Cloudflare tasks in this skill. **Do not tell Jack
  you lack Cloudflare credentials without first running `wrangler whoami`.**
- AutoVault-stored credential helpers are fallback paths when global Wrangler
  auth is unavailable or lacks required scope.
- Billable Cloudflare actions still require explicit user confirmation in the
  conversation before the agent runs them. A single DNS TXT for domain
  verification is not billable — proceed.

## DNS TXT for domain verification (wpfusion.com)

When Wordfence (or similar) asks for a TXT on `wpfusion.com`:

| Item | Value |
|------|-------|
| Account | Very Good Plugins (`CLOUDFLARE_ACCOUNT_ID`) |
| Zone | `wpfusion.com` → id `41d3ea9c35eda46091348ef05e861d3a` |
| API | `Authorization: Bearer $CLOUDFLARE_API_TOKEN` |
| Typical record | TXT `wpfusion.com` `wfvendor=<token>` TTL 600 |

Confirm with `dig @1.1.1.1 +short TXT wpfusion.com`.

## Workflow

1. Run a preflight first:

```bash
autovault skill doctor cloudflare-ops --repo .
```

2. Use `dry-run` before any mutation:

```bash
autovault skill dry-run cloudflare-ops --repo . --task deploy-pages
```

3. Dispatch supported tasks through the signed wrapper:

```bash
autovault skill run cloudflare-ops --repo . --task deploy-pages -- --slug=my-site --dir=dist
autovault skill run cloudflare-ops --repo . --task setup-d1-preview -- --slug=my-site
autovault skill migrate cloudflare-ops --repo . --target local
autovault skill migrate cloudflare-ops --repo . --target preview
autovault skill sync cloudflare-ops --repo . --mode sidecar
autovault skill run cloudflare-ops --repo . --task tunnel-start
```

## Supported Tasks

- `deploy-pages` — **setup-only** helper. Creates the Pages project and
  attaches custom domains. If the chosen model is Git-connected Pages, it may
  also connect the project to GitHub. If the chosen model is Direct Upload from
  CI, ongoing deploys stay in the repo workflow.
- `setup-d1` — production D1 + KV pair.
- `setup-d1-preview` — preview D1 + KV pair, designed to feed
  `CLOUDFLARE_PREVIEW_D1_DATABASE_ID` and `CLOUDFLARE_PREVIEW_KV_NAMESPACE_ID`
  GitHub repo variables for PR-preview deploys.
- `tunnel-setup`
- `tunnel-start`
- D1 migration targets: `local`, `preview`, `remote`
- D1 sync modes: `sidecar`, `daemon`, `backfill`, `parity`

## Preview Resource Pairs

PR-preview deploys must run against an isolated D1 + KV pair so preview traffic
never writes to production data. The expected shape:

- One preview D1 database per project, named `<project>-preview` or
  `<project>-hosted-preview`. Capture both its `database_id` and
  `database_name`.
- One preview KV namespace per project, named `<project>-vault-objects-preview`
  or similar. Capture its `id`.
- Apply the same migrations to preview D1 that production uses. The
  `migrate --target preview` task is the supported path.
- Surface the IDs to CI as repository variables (not secrets — these IDs are
  safe to commit-adjacent and are referenced from `wrangler.preview.json` /
  `scripts/write-pages-preview-config.mjs` style generators):
  - `CLOUDFLARE_PREVIEW_D1_DATABASE_ID`
  - `CLOUDFLARE_PREVIEW_D1_DATABASE_NAME`
  - `CLOUDFLARE_PREVIEW_KV_NAMESPACE_ID`
- For per-environment Pages secrets (`CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, etc.) the standard
  `wrangler pages secret put` writes production only — see the
  **Per-Environment Pages Env Vars** section in `cloudflare-commerce-deploy`
  for the project-level PATCH endpoint that writes the preview environment.

When `setup-d1-preview` finishes, report the database name, database id, KV id,
and the exact `gh variable set` lines the user can paste — never the
production values.

## Output

Report the repo, task, exact helper invoked, and whether the run was a dry run.
For preview-pair tasks, also report the database name, database id, KV id, and
the GitHub variable names the user must set. Only report secret names or
provider-side secret references, never raw values.

## Anti-Patterns

- Do not run ad hoc local `wrangler pages deploy` against a Pages project whose
  `source.type == "github"`. It bypasses that project's canonical build path
  and creates split-brain deploys. Push to `main` instead.
- Do not "fix" a repo that already uses Direct Upload from CI by adding a second
  Git-connected deploy path. Pick one deployment model and keep it singular.
- When deploying a single HTML file to Cloudflare Pages (e.g. an artifact), do NOT pass the file path directly to `wrangler pages deploy file.html`. This uploads the file as `file.html` and it will not be served at the root URL. Instead, place the file in a directory, rename it to `index.html`, and deploy the directory: `mkdir dist && cp file.html dist/index.html && wrangler pages deploy dist`.
- Do not manually copy Cloudflare tokens into project files.
- Do not register domains or create billable resources without explicit user
  confirmation.
- Do not bypass the repo helper scripts when they already encode project
  conventions.
- Do not run `migrate --target remote` against production when the intent was
  preview — the wrong target silently corrupts the wrong database.
- Do not point preview deploys at the production D1 or KV. The preview pair
  exists specifically so PR traffic is isolated.
