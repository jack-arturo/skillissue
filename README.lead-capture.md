# Lead capture (skillissue.sh)

Scaffolded from AutoVault skill `cloudflare-lead-capture`.

## Status

- Functions: `functions/api/signup.js`, `lead.js`, unsubscribe, admin
- Schema: `schema/lead-capture.sql`
- **D1 not bound yet** — Cloudflare account is at free-tier D1 limit (10/10).

## When a D1 slot opens

```bash
npx wrangler d1 create skillissue-leads
# paste database_id into wrangler.toml [[d1_databases]]
npx wrangler d1 execute skillissue-leads --remote --file ./schema/lead-capture.sql
npx wrangler pages secret put RESEND_API_KEY --project-name skillissue
npx wrangler pages secret put ADMIN_TOKEN --project-name skillissue
# optional: CONFIRM_SECRET, TURNSTILE_SECRET_KEY
```

Also bind D1 on the Pages project (dashboard or wrangler.toml) as `LEAD_DB`.

## Binding name

Handlers expect `env.LEAD_DB` or the default from `getDb` — check `functions/lib/lead-capture/http.js`.
