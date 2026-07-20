---
name: cloudflare-lead-capture
description: Scaffold Cloudflare Pages or Workers lead-capture systems (Pages Functions OR Astro SSR API routes) with D1 contacts, web forms, Resend email templates, unsubscribe links, Turnstile checks, exports, and a small admin UI when a project needs repeatable email database infrastructure.
license: MIT
tags: [cloudflare, d1, resend, email, lead-capture, forms, turnstile, autovault, commerce]
agents: [claude-code, codex, autojack]
category: cloudflare
metadata:
  version: "1.4.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Node, Read, Edit]
requires-secrets: []
resources:
  - path: bin/setup
    type: file
  - path: bin/scaffold
    type: file
  - path: bin/doctor
    type: file
  - path: templates/project/schema/lead-capture.sql
    type: file
  - path: templates/project/functions/lib/lead-capture/http.js
    type: file
  - path: templates/project/functions/lib/lead-capture/tokens.js
    type: file
  - path: templates/project/functions/lib/lead-capture/turnstile.js
    type: file
  - path: templates/project/functions/lib/lead-capture/email.js
    type: file
  - path: templates/project/functions/api/signup.js
    type: file
  - path: templates/project/functions/api/lead.js
    type: file
  - path: templates/project/functions/unsubscribe.js
    type: file
  - path: templates/project/functions/admin/lead-capture.js
    type: file
  - path: templates/project/functions/admin/lead-capture/templates.js
    type: file
  - path: templates/project/functions/admin/lead-capture/test-email.js
    type: file
  - path: templates/project/lead-capture-admin.html
    type: file
  - path: templates/project/snippets/lead-form.html
    type: file
  - path: templates/project/README.lead-capture.md
    type: file
  - path: templates/project/wrangler.toml
    type: file
  - path: templates/project/wrangler.lead-capture.jsonc
    type: file
  - path: templates/astro-ssr/src/pages/api/contact.ts
    type: file
  - path: templates/astro-ssr/src/components/ContactForm.astro
    type: file
  - path: templates/astro-ssr/README.astro-ssr.md
    type: file
bin:
  setup:
    command: bin/setup
    description: Configure Cloudflare D1 and Pages secrets for lead capture without exposing secret values to the agent.
    requires-tty: true
  scaffold:
    command: bin/scaffold
    description: Generate the lead-capture layer in the current project. Auto-detects Pages Functions vs Astro SSR (Astro + @astrojs/cloudflare); force with --mode pages|astro-ssr. astro-ssr emits the shared D1 schema + an Astro API route (src/pages/api/contact.ts) + a ContactForm component; pages emits Functions, admin UI, and form snippets.
    requires-tty: false
  doctor:
    command: bin/doctor
    description: Verify local lead-capture project files, Wrangler config, and expected secret names.
    requires-tty: false
---

# Cloudflare Lead Capture

## When To Use

Use this skill when a user wants a repeatable Cloudflare-based email database, waitlist, contact form, capture form, web lead form, or small lead-management backend. It is designed for Cloudflare Pages Functions or Workers with D1 as the system of record and Resend for outbound email.

Use the separate `cloudflare-commerce-deploy` skill for deployment, DNS, custom domains, or other Cloudflare operator work. This skill owns only the lead-capture and email-template layer.

For projects with separate preview and production environments, see the **Per-Environment Pages Env Vars** section in `cloudflare-commerce-deploy` for how to set `RESEND_API_KEY`, `ADMIN_TOKEN`, and `TURNSTILE_SECRET_KEY` differently per environment. `wrangler pages secret put` only writes to production; preview-environment secrets require the project-level PATCH endpoint.

## Two project shapes

**Decide which shape the project is before scaffolding — they wire endpoints and bindings differently:**

- **Cloudflare Pages** (static site + `functions/`): use the `bin/scaffold` templates below. Endpoints are Pages Functions (`functions/api/*.js`); bindings arrive as the handler's `env` argument; secrets via `wrangler pages secret put`.
- **Astro SSR on Workers** (`output: 'server'`, `@astrojs/cloudflare`, `wrangler deploy` — e.g. an EmDash/Astro site, see `cloudflare-emdash-cms-deploy`): there is **no `functions/` directory**. Hand-write the same patterns as Astro API routes (next section). The scaffold's `schema/` and `lib/` files are still useful references.

## Astro SSR (Workers) variant

**Scaffold it:** `autovault skill scaffold cloudflare-lead-capture -- --mode=astro-ssr` (auto-detected for Astro + `@astrojs/cloudflare` projects; binding defaults to `DB`). It emits the shared `schema/lead-capture.sql` + `src/pages/api/contact.ts` (writes to `contacts`/`submissions` so the admin UI/exports see these leads; lead-never-lost; honeypot) + `src/components/ContactForm.astro` (fetch enhancement with a no-JS `?sent=1` fallback). Then apply the schema, set `RESEND_API_KEY` (Worker secret) + `NOTIFY_FROM`/`NOTIFY_TO` vars, render `<ContactForm />`, and `wrangler deploy`. See the generated `README.astro-ssr.md`.

If hand-writing instead, the contract is:

- **Endpoint:** `src/pages/api/<form>.ts` exporting `POST`, with `export const prerender = false` (must run on the worker).
- **Bindings (Astro 6+):** `import { env } from "cloudflare:workers"` — `env.DB` (D1), `env.RESEND_API_KEY` (Worker secret), and any non-secret `vars` from `wrangler.jsonc` (e.g. `CONTACT_FROM`, `CONTACT_TO`). Astro 6 removed `Astro.locals.runtime.env`; the **`cloudflare-emdash-cms-deploy`** skill owns the full why (it surfaces as an empty HTTP 500, not your JSON error path).
- **D1:** create a `contact_messages` / `leads` table; `await env.DB.prepare("INSERT ...").bind(...).run()`. Store the lead **first**, then send email best-effort — a send failure must NOT lose the saved lead.
- **Resend:** `POST https://api.resend.com/emails` with header `Authorization: Bearer <RESEND_API_KEY>` and a JSON body (`from`, `to`, `reply_to`, `subject`, `html`, `text`). Use a **send-only, domain-scoped** key — `resend api-keys create --name <svc> --permission sending_access --domain-id <id> -q` (api-keys flag contract: **`resend-cli`**) — piped straight into `wrangler secret put RESEND_API_KEY`, never printed.
- **Form:** plain `<form action="/api/contact" method="POST">` enhanced with a JS `fetch` (send `X-Requested-With: fetch` to get a JSON response) and a no-JS `303 → ?sent=1` fallback. Add a honeypot field + `maxlength` caps.
- **Secrets:** `wrangler secret put RESEND_API_KEY` (Worker secret) — **not** `wrangler pages secret put`.

## Brand-styled emails (React Email)

The scaffold emits plain notification HTML. For **brand-matched** transactional emails (the contact notification, plus invites/receipts), author **React Email** `.tsx` templates instead of inlining HTML, and follow the **`react-email`** skill (build templates) + **`email-best-practices`** skill (deliverability, accessibility, suppression). This skill owns the lead pipeline; those own the email design + deliverability.

- **Brand once, reuse:** put tokens in `emails/brand.ts` mirrored from the site's CSS (colors, fonts, logo mark) + a shared `BrandLayout` shell (masthead + footer); every template wraps its body in it so all emails match the site.
- **Render in the Worker at request time:** `@react-email/render` ships a **`workerd` export** (edge build → `react-dom/server.edge`), so `render(createElement(Template, props))` runs inside the Worker — no extra runtime needed when the Astro app already SSRs React via `@astrojs/react`. Render `{ plainText: true }` for the text part too.
- **Preview:** add `"email": "email dev --dir emails --port 3000"` to `package.json` (needs `@react-email/ui`); each template exports `.PreviewProps` for sample data.
- **Gotchas:** render newlines as `<br/>` — `white-space: pre-line` is ignored by Outlook. Use `pixelBasedPreset` (no `rem`), tables not flexbox/grid, always specify border style (`border-solid`), PNG/JPG only (no SVG/WEBP), keep under ~102KB (Gmail clips). Keep the send **best-effort** — a render/send failure must not lose the saved lead.

## Prerequisites

1. The project should be a Cloudflare Pages or Workers project, or a static site that can accept a `functions/` directory.
2. Wrangler should be available before remote setup or deployment.
   If global Wrangler auth is already configured (`wrangler login` state and/or
   `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` from shell startup), use it
   directly as the default Cloudflare credential path.
3. The user must configure secrets from their own terminal. Never ask them to paste `RESEND_API_KEY`, `ADMIN_TOKEN`, `TURNSTILE_SECRET_KEY`, or Cloudflare credentials into chat.
4. If the project already has form endpoints, inspect them first and preserve existing behavior unless the user explicitly asks to replace it.

## Workflow

### 1. Inspect The Project

Check for `wrangler.toml`, `wrangler.jsonc`, `functions/`, existing D1 bindings, existing signup/contact endpoints, and existing admin routes. Prefer Cloudflare Pages Functions for static sites; use the Astro SSR variant when the project is an Astro `output: 'server'` Worker.

If an existing lead-capture stack is present, run in **adoption mode** instead
of scaffold mode. Inventory the current endpoints, tables, env var names,
email provider calls, unsubscribe/confirm routes, admin token behavior, and
preview/production bindings. Report which generated pieces are already covered,
which safety gaps remain, and which templates should be skipped.

### 2. Scaffold The Lead-Capture Layer

From the project root, run:

```bash
autovault skill scaffold cloudflare-lead-capture
```

Useful options:

```bash
autovault skill scaffold cloudflare-lead-capture -- --project-name=my-site --database-name=my-site-leads --database-id=<d1-id> --binding=LEAD_DB
autovault skill scaffold cloudflare-lead-capture -- --force
```

The scaffold action writes:

- D1 schema under `schema/lead-capture.sql`.
- Pages Functions under `functions/api`, `functions/admin`, and `functions/lib/lead-capture`.
- `lead-capture-admin.html` for a basic token-protected admin UI.
- `snippets/lead-form.html` for copy-paste signup and lead forms.
- `README.lead-capture.md` with setup, schema, and smoke-test commands.

Existing files are skipped unless `--force` is passed. (Astro SSR projects: skip scaffold, hand-write API routes per the Astro SSR variant section; reuse `schema/` and `lib/` as references.)

In adoption mode, do not run `--force`. Patch only the missing safety pieces the
inspection identified, such as Turnstile server verification, signed
unsubscribe tokens, admin auth consistency, or preview-only env vars.

### 3. Configure Cloudflare And Secrets

If global Wrangler auth is missing or lacks required scope, ask the user to run:

```bash
autovault skill setup cloudflare-lead-capture
```

The setup action can create or record a D1 database and invokes Wrangler secret prompts for `RESEND_API_KEY`, `ADMIN_TOKEN`, optional `TURNSTILE_SECRET_KEY`, and optional `CONFIRM_SECRET`. The agent must not handle the raw secret values.

### 3b. Resend sending domain (project custom domain)

**Hard rule:** When the site has a custom domain on Cloudflare (Pages custom domain or zone already active), **create and verify that exact domain in Resend** before shipping production `FROM_EMAIL`. Do **not** silently set `FROM_EMAIL` to a sibling verified domain (`*.autojack.ai`, another product zone, etc.) as a permanent workaround.

Validated agent path (non-interactive; see **`resend-cli`**):

1. Ensure `RESEND_API_KEY` is in the environment (never print it).
2. Create the domain (or skip create if `resend domains list` already has it):

```bash
resend domains create --name example.com --region eu-west-1 -q
# → id + records[] (DKIM TXT, SPF MX on send, SPF TXT on send)
```

3. Add DNS on the **project’s Cloudflare zone** (proxied **off** for MX/TXT Resend records):

| Resend record | CF type | CF name (relative OK) | Notes |
|---|---|---|---|
| DKIM | TXT | `resend._domainkey` | Prefer value as returned; if value starts with `p=`, prefix `v=DKIM1; k=rsa; ` |
| SPF | MX | `send` | `content` = Resend host, `priority` = 10 |
| SPF | TXT | `send` | e.g. `v=spf1 include:amazonses.com ~all` |

Use Zone DNS API or dashboard; zone must already be on Cloudflare (this stack assumes that).

4. Trigger verify and poll until `status == "verified"`:

```bash
resend domains verify <domain-id> -q
resend domains get <domain-id> -q   # poll; records[] should all be verified
```

5. Set production From to an address **on that domain**, e.g. `hello@example.com` / `noreply@example.com`:

- Pages vars: `FROM_EMAIL`, `FROM_NAME` (project PATCH env_vars and/or `wrangler.toml` `[vars]`)
- Prefer a send-only, domain-scoped Resend API key when rotating keys (`resend api-keys create … --domain-id <id>` — **`resend-cli`**)

**Allowed temporary fallback:** only if DNS cannot be written yet (zone not on CF, no token scope, or user forbids DNS edits). Then:

- State the blocker explicitly in the handoff
- Use a verified sibling From **and** leave a tracked TODO to flip to the project domain
- Do not treat the sibling From as “done”

**Reference:** Resend [Verify Domain](https://resend.com/docs/api-reference/domains/verify-domain) (`POST /domains/{id}/verify`); CLI: `resend domains verify <id>`.

### 4. Apply Schema And Wire The UI

Apply `schema/lead-capture.sql` to the bound D1 database. Then copy the signup or lead form snippet into the site, or adapt the project’s existing form to submit JSON to:

- `POST /api/signup` for simple email capture.
- `POST /api/lead` for general lead forms.

If Turnstile is enabled, make sure the frontend sends `cf-turnstile-response` or `turnstileToken`; the server validates the token with Cloudflare Siteverify before accepting the submission.

### 5. Verify

Run:

```bash
autovault skill doctor cloudflare-lead-capture
```

Then smoke-test locally with Wrangler Pages dev or a non-production Cloudflare project before connecting production forms. For an Astro SSR Worker, deploy and POST a real submission, then confirm the D1 row was written AND the provider reports the message delivered (`resend emails list`).

For projects that already have a live waitlist or CMS, verify preview traffic
does not write to production D1/KV unless the user explicitly accepts that risk
for a read-only surface. Lead forms, admin actions, test emails, and template
edits should use preview resources in PR previews.

## Generated Behavior

- D1 stores contacts, form definitions, submissions, template rows, and email delivery events.
- Signup and lead handlers validate email, required fields, field lengths, source, UTM metadata, consent state, and Turnstile when configured.
- Resend confirmation and notification emails are sent from server-side Functions. Failures are recorded but do not discard the captured lead.
- Template rendering uses allowlisted `{{placeholder}}` replacement. It does not execute arbitrary template code.
- Unsubscribe links use signed expiring HMAC tokens and update contact consent state.
- Admin endpoints require `ADMIN_TOKEN` via Bearer auth or a query token and can return JSON or CSV.

## Output

When finished, report:

- Which files were generated, skipped, or overwritten.
- Whether the run was scaffold mode or adoption mode.
- The D1 binding name and database name/id to verify in Wrangler config.
- Which secrets must be set by name only.
- How to reach the admin UI and which endpoint each form should submit to.
- Any tests or smoke checks run.

## Anti-Patterns

- Do not paste, print, commit, or summarize raw API keys or admin tokens.
- Do not replace an existing form stack without reading it first.
- Do not force the scaffold over a project that already has signup, unsubscribe,
  admin, or email-template endpoints; adapt it in adoption mode.
- Do not scaffold Pages Functions into an Astro SSR Worker project (no `functions/` runtime there) — use the Astro SSR variant instead.
- Do not skip server-side Turnstile validation; the widget alone is not protection.
- Do not use D1 as a bulk newsletter sender. Store contacts and events in D1, send through a real email provider, and respect unsubscribe state.
- Do not turn the generated admin UI into a full CRM without explicit scope; it is a small operational surface for early projects.
- **Do not skip Resend domain verification for the project’s custom domain** when the zone is already on Cloudflare and the agent can write DNS + call Resend. Using a random already-verified domain “because it works” is a failed ship for production From identity (skillissue lesson 2026-07-20).
