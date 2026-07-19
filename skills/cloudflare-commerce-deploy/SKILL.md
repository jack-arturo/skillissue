---
name: cloudflare-commerce-deploy
description: Deploy and operate commerce apps on Cloudflare when a user wants Pages or Workers deployment, DNS/custom domains, storage bindings, secrets, logs, per-environment env vars, or optional Registrar domain registration handled by an agent.
license: MIT
tags: [cloudflare, commerce, deployment, dns, pages, workers, registrar, autovault]
agents: [claude-code, codex, autojack]
category: deployment
metadata:
  version: "1.0.3"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Node, Read, Edit]
requires-secrets: []
resources:
  - path: bin/setup
    type: file
  - path: bin/doctor
    type: file
  - path: bin/dry-run
    type: file
  - path: templates/cloudflare-commerce.json
    type: file
bin:
  setup:
    command: bin/setup
    description: Configure broad Cloudflare operator credentials outside the repository.
    requires-tty: true
  doctor:
    command: bin/doctor
    description: Verify stored Cloudflare credentials and broad commerce-deploy permissions.
    requires-tty: true
  dry-run:
    command: bin/dry-run
    description: Run safe Cloudflare read-only and no-charge deployment preflight checks.
    requires-tty: true
---

# Cloudflare Commerce Deploy

## When To Use

Use this skill when a user wants an agent to take a web or commerce project from
local code to Cloudflare: Pages or Workers deploys, DNS mapping, custom domains,
D1/KV/R2/Queues setup, environment variables, secrets, logs, cache operations,
or optional domain registration through Cloudflare Registrar.

For full one-shot Clerk + Stripe + Cloudflare builds, drive this skill from
`clerk-cloudflare-commerce-bootstrap`. For preview D1 + KV pair provisioning
and migrations, see `cloudflare-ops`.

## Preconditions

1. Prefer existing Wrangler/operator auth first. If the machine already has
   `wrangler login` state or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
   exported in shell startup (for example `~/.zshrc`), use it directly:

```bash
npx wrangler whoami
```

2. If Wrangler auth is missing or insufficient for the requested action, ask
   the user to run:

```bash
autovault skill setup cloudflare-commerce-deploy
```

3. To verify available operator access (Wrangler auth and/or AutoVault
   credential profile), ask them to run:

```bash
autovault skill doctor cloudflare-commerce-deploy
```

4. Never ask the user to paste Cloudflare tokens into chat. If setup is used,
   it opens the relevant Cloudflare pages and stores the token outside the
   repository under the AutoVault storage root.

## Credential Profile

The setup action stores a local credential profile at:

```text
$AUTOVAULT_STORAGE_PATH/credentials/cloudflare-commerce.json
```

Use profile `default` unless the user names another profile through
`AUTOVAULT_CLOUDFLARE_PROFILE`. Project files may reference this credential as:

```text
AUTOVAULT_SECRET:cloudflare-commerce:<profile>:CLOUDFLARE_API_TOKEN
```

Do not copy the raw token into project files, `.env` files, PR descriptions, or
agent messages.

Wrangler global auth (interactive `wrangler login` state and/or
`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` exported at shell startup) is a
first-class credential source for this skill. Treat AutoVault's stored
credential profile as an additional profile/fallback path, not a mandatory
replacement for working Wrangler auth.

## Pages Deploy Models

Cloudflare Pages projects should have one canonical deploy path. Inspect the
repo workflow and the Pages project before changing it.

### Git-connected Pages

Pages can deploy via `git push` to a connected GitHub repo. The Wrangler CLI
creates the project and attaches custom domains; a Cloudflare API call wires the
project to GitHub; from that point on, every push to the production branch
triggers an auto-build. Do **not** run ad hoc local `wrangler pages deploy`
against a Git-connected project — it bypasses that project's canonical path and
creates split-brain deploys.

Order of operations for a new Pages project:

1. `wrangler pages project create <project_name> --production-branch=main`.
2. Attach custom domains (Pages domains API or dashboard).
3. Connect the project to its GitHub repo:

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

4. Set build command and output directory in the dashboard or via PATCH
   `deployment_configs.{preview,production}.build_config`.
5. `git push origin main`. Cloudflare auto-builds.

Verify the wiring with `GET …/pages/projects/<project_name>` and confirm
`result.source.type == "github"`.

### Direct Upload from CI

Pages can also be deployed by GitHub Actions using `wrangler pages deploy`
after the repo's tests and build pass. This is a healthy model when the workflow
is the only deploy path and passes `--project-name`, `--branch`, and
`--commit-hash`. Keep this model when a repo already uses it; do not add a
second Git-connected auto-build unless the user asks to migrate deployment
models.

## Workflow

1. Inspect the app and choose the Cloudflare surface:
   - Pages for static or Pages Functions apps.
   - Workers for Worker-first apps.
   - D1/KV/R2/Queues only when the app actually needs those bindings.

2. Build a non-secret project manifest from
   `templates/cloudflare-commerce.json` when the repo lacks one. Store account
   IDs, zone IDs, Pages project names, domains, bindings, and secret reference
   names only.

3. Before deployment, run safe checks:
   - Confirm the stored profile with the doctor action.
   - Validate local Cloudflare config with Wrangler when available.
   - Confirm required secrets are present in Cloudflare before production.

4. Choose and record the Pages deploy model in the project manifest:
   - `github-connected` when Cloudflare builds from a connected repo.
   - `direct-upload-ci` when GitHub Actions builds and uploads with Wrangler.
   - `manual-only` only for throwaway artifacts, never for production commerce.

5. For custom domains, attach the domain to the Pages project or Worker route
   first, then create or update DNS. For Pages, do not rely on manually adding a
   CNAME alone. For Git-connected Pages, follow the order in
   "Git-connected Pages" above: create project → attach domains → connect to
   GitHub → push. For Direct Upload from CI, attach domains and keep deployment
   in the checked-in workflow.

6. For logs and post-deploy triage, use available Workers/Pages logs, Workers
   Tail, Pages deployment logs, Analytics, and Logpush/Logpull permissions when
   configured.

## Per-Environment Pages Env Vars

Cloudflare Pages projects have separate `preview` and `production` environments
with independent environment variables and secrets. Driving these correctly is
critical for PR previews that must not touch production data or live keys.

### Why `wrangler pages secret put` is not enough

`wrangler pages secret put <NAME> --project-name <project>` writes to the
**production** environment only. There is no `--environment` flag for this
command in wrangler v4.x. Setting a preview-environment secret requires the
project-level PATCH endpoint.

### Reading current per-environment env vars

```bash
curl -sS \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT_NAME" \
  | jq '.result.deployment_configs | {preview: .preview.env_vars, production: .production.env_vars}'
```

`secret_text`-typed values come back redacted on read — they are write-only.
The agent cannot copy preview→production by reading values; the user must
re-provide the value (typically from Keychain, an AutoVault credential
profile, or another secret store).

### Writing per-environment env vars

PATCH the Pages project with one or both `deployment_configs.{preview|production}.env_vars`
maps. Each entry is either `{"type": "plain_text", "value": "..."}` or
`{"type": "secret_text", "value": "..."}`.

```bash
curl -sS -X PATCH \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PAGES_PROJECT_NAME" \
  --data @- <<'JSON'
{
  "deployment_configs": {
    "preview": {
      "env_vars": {
        "CLERK_SECRET_KEY":      { "type": "secret_text", "value": "<test secret>" },
        "VITE_CLERK_PUBLISHABLE_KEY": { "type": "plain_text", "value": "<pk_test_...>" },
        "STRIPE_SECRET_KEY":     { "type": "secret_text", "value": "<sk_test_...>" },
        "STRIPE_WEBHOOK_SECRET": { "type": "secret_text", "value": "<whsec_test_...>" }
      }
    },
    "production": {
      "env_vars": {
        "CLERK_SECRET_KEY":      { "type": "secret_text", "value": "<live secret>" },
        "VITE_CLERK_PUBLISHABLE_KEY": { "type": "plain_text", "value": "<pk_live_...>" },
        "STRIPE_SECRET_KEY":     { "type": "secret_text", "value": "<sk_live_...>" },
        "STRIPE_WEBHOOK_SECRET": { "type": "secret_text", "value": "<whsec_live_...>" }
      }
    }
  }
}
JSON
```

PATCH is **merge** at the env-var key level: existing keys not in the request
remain. Setting a key to `null` deletes it. Setting `value` to an empty string
sets it to empty — usually not what is wanted.

### Recommended split

- Preview environment: test-mode keys only (`sk_test_…`, `pk_test_…`,
  `whsec_test_…`, Clerk dev/test instance keys).
- Production environment: live-mode keys, gated by the test-mode-default rule
  in `stripe-commerce-checkout`.
- Vite/VitePress browser keys are build-time inputs: `VITE_CLERK_PUBLISHABLE_KEY`
  must be available to the build command, not only present as a runtime Pages
  env var. Prefer CI source variables named
  `VITE_CLERK_PREVIEW_PUBLISHABLE_KEY=pk_test_…` and
  `VITE_CLERK_PRODUCTION_PUBLISHABLE_KEY=pk_live_…`, then set the app-facing
  `VITE_CLERK_PUBLISHABLE_KEY` from the matching source variable before the
  static build.
- Plain-text (non-secret) values, e.g. `AUTOVAULT_ENVIRONMENT=preview` vs
  `production`, also belong in `env_vars` with `type: plain_text`.
- Preview D1/KV bindings should point at preview resources for any form,
  checkout, auth, CMS, or admin surface that writes data. If an existing repo
  shares production bindings in preview, report it as a data-isolation gap
  before enabling PR-preview traffic.

### Anti-patterns specific to this surface

- Do not assume `wrangler pages secret put` covers preview — it doesn't.
- Do not paste production live secrets into the preview environment "to keep
  things consistent." Preview is the test-mode surface.
- Do not try to read a `secret_text` value back; the API returns it redacted.
  Re-provide from the user's secret store.

## Domain Registration Rule

Domain registration is billable and non-refundable. Before calling a Registrar
registration endpoint:

1. Run an immediate availability and pricing check.
2. Present the exact domain, registration period, price, currency, and renewal
   behavior to the user.
3. Require an explicit confirmation in the current conversation.
4. Do not register premium domains through the API.
5. Leave `auto_renew` off unless the user explicitly asks for it.

## Output

When finishing Cloudflare deployment work, report:

- Deployed project name and URL.
- Custom domains attached and DNS records changed.
- Bindings created or reused.
- Secrets set by name only — and which environment (preview, production, or
  both) each was applied to.
- Any billable actions confirmed by the user.
- Logs or checks inspected after deploy.

## Anti-Patterns

- Do not use ad hoc local `wrangler pages deploy` for ongoing deploys on a
  GitHub-connected Pages project. Push to `main` and let Cloudflare auto-build.
- Do not add Git-connected auto-builds to a repo that already uses Direct Upload
  from CI without intentionally migrating the deployment model.
- When deploying a single HTML file to Cloudflare Pages, do NOT pass the file path directly to `wrangler pages deploy file.html`. This uploads the file as `file.html` and it will not be served at the root URL. Instead, place the file in a directory, rename it to `index.html`, and deploy the directory: `mkdir dist && cp file.html dist/index.html && wrangler pages deploy dist`.
- Do not paste, print, commit, or summarize raw Cloudflare tokens.
- Do not register domains without explicit confirmation after live price check.
- Do not create D1/KV/R2/Queues speculatively when the app does not need them.
- Do not skip Pages custom-domain association and only add DNS.
- Do not leak production env vars into the preview environment.
