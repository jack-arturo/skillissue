# Lead capture (skillissue.sh)

- D1: `skillissue-leads` id `698ae99b-c2d7-4e00-8836-0a11a34ec99c`
- Binding: `LEAD_DB` (production + preview)
- Secrets (Pages production): `RESEND_API_KEY`, `ADMIN_TOKEN`, `CONFIRM_SECRET`
- From: `hello@skillissue.sh` (Resend domain verified)

## Smoke

```bash
curl -sS https://skillissue.sh/api/signup \
  -H 'Content-Type: application/json' -H 'X-Requested-With: fetch' \
  -d '{"email":"test@example.com","source":"smoke"}'
```

Admin: `lead-capture-admin.html` with Bearer `ADMIN_TOKEN` (local `.dev.vars`, gitignored).
