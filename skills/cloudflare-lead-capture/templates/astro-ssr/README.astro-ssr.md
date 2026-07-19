# Lead capture — Astro SSR (Cloudflare Workers)

Generated for an **Astro `output: 'server'` + `@astrojs/cloudflare`** project deployed as a Worker
(e.g. an EmDash/Astro site — see the `cloudflare-emdash-cms-deploy` skill). This is the SSR sibling
of the Pages-Functions path; it shares the same D1 schema, so the admin UI / CSV export see these
leads too.

## Files

- `src/pages/api/contact.ts` — SSR `POST /api/contact`. Validates, stores the lead in
  `contacts` + `submissions` (lead is the system of record, never lost), then best-effort
  emails a notification via Resend. Bindings come from `import { env } from "cloudflare:workers"`
  (Astro 6 removed `Astro.locals.runtime.env`).
- `src/components/ContactForm.astro` — the form. JS `fetch` with inline success; no-JS falls back
  to `303 → ?sent=1`. Includes a honeypot + length caps.
- `schema/lead-capture.sql` — shared D1 schema (`contacts`, `submissions`, …).

## Setup

```bash
# 1. Apply the schema to your D1 (the binding your wrangler.jsonc already uses, e.g. DB)
wrangler d1 execute <your-d1> --remote --file=schema/lead-capture.sql

# 2. Notification config — set vars in wrangler.jsonc and the secret out-of-band
#    "vars": { "NOTIFY_FROM": "__FROM_NAME__ <__FROM_EMAIL__>", "NOTIFY_TO": "you@example.com" }
#    RESEND_API_KEY: a send-only, domain-scoped key — never printed/committed:
resend api-keys create --name <site>-worker --permission sending_access --domain-id <id> -q \
  | python3 -c "import sys,json;sys.stdout.write(json.load(sys.stdin)['token'])" \
  | wrangler secret put RESEND_API_KEY

# 3. Build + deploy, then verify end-to-end
npm run build && wrangler deploy
curl -X POST "https://<host>/api/contact" -H 'X-Requested-With: fetch' \
  -F name='Test' -F email='test@example.com' -F message='hello'
# Confirm a row in `submissions` AND that Resend reports delivered (`resend emails list`).
```

## Notes

- The `D1Database` type comes from `@cloudflare/workers-types` (a dev dependency in EmDash/Astro
  projects). The `__D1_BINDING__` placeholder is your D1 binding name (defaults to `DB`).
- This SSR endpoint is intentionally leaner than the Pages-Functions variant: no Turnstile,
  signed-unsubscribe, or template-driven emails. Add those from `functions/lib/lead-capture/*`
  if you need them, or keep this lean for a simple contact form.
