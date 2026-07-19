# Cloudflare Lead Capture

This project has the generated Cloudflare lead-capture layer from the `cloudflare-lead-capture` AutoVault skill.

## Files

- `schema/lead-capture.sql` - D1 tables, indexes, views, default forms, and default email templates.
- `functions/api/signup.js` - `POST /api/signup` simple email signup endpoint.
- `functions/api/lead.js` - `POST /api/lead` general web lead form endpoint.
- `functions/unsubscribe.js` - signed unsubscribe endpoint.
- `functions/admin/lead-capture.js` - token-protected JSON and CSV export.
- `functions/admin/lead-capture/templates.js` - token-protected template read/update endpoint.
- `functions/admin/lead-capture/test-email.js` - token-protected test email endpoint.
- `lead-capture-admin.html` - small admin UI.
- `snippets/lead-form.html` - copy-paste frontend forms.

## Required Cloudflare State

- D1 binding: `__D1_BINDING__`
- D1 database name: `__DATABASE_NAME__`
- D1 database id: `__DATABASE_ID__`
- Required Pages secrets: `RESEND_API_KEY`, `ADMIN_TOKEN`
- Optional Pages secrets: `TURNSTILE_SECRET_KEY`, `CONFIRM_SECRET`
- Optional notification var: `LEAD_NOTIFY_EMAIL`

## Apply Schema

```bash
wrangler d1 execute __DATABASE_NAME__ --remote --file ./schema/lead-capture.sql
```

For local development, run the same file against the local D1 database or use Wrangler Pages dev with the configured binding.

## Smoke Tests

```bash
curl -s http://localhost:8788/api/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test","source":"local-smoke"}'

curl -s http://localhost:8788/api/lead \
  -H "Content-Type: application/json" \
  -d '{"form_id":"lead","email":"lead@example.com","name":"Lead","message":"Hello","source":"local-smoke"}'
```

Admin endpoints accept `Authorization: Bearer <ADMIN_TOKEN>` or `?token=<ADMIN_TOKEN>`.

## Email Templates

Templates are stored in D1 rows keyed by `key` and `channel`. Supported placeholders are simple `{{name}}` values. HTML variables are escaped before insertion; template bodies are not executable code.

Default keys:

- `welcome`
- `lead-confirmation`
- `internal-notification`
- `test-email`

## Turnstile

If `TURNSTILE_SECRET_KEY` is configured, `/api/signup` and `/api/lead` require `cf-turnstile-response` or `turnstileToken` in the submitted payload and validate it server-side with Cloudflare Siteverify.
