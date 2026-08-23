# Custom domain attachment

Attaching a custom domain to an already-deployed EmDash Worker (after
`references/deploy.md`'s Recipe step 3).

Prerequisite: the domain must live on a Cloudflare zone you control — grab its
`zone_id` (see `references/project-setup.md` Preflight #4).

```bash
export CLOUDFLARE_API_TOKEN=...   # scoped token (see references/project-setup.md Preflight #3)
export CLOUDFLARE_ACCOUNT_ID=...

# Custom domain on a Worker (API; wrangler routes also work)
curl -X PUT -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H 'Content-Type: application/json' \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/domains" \
  -d '{"environment":"production","hostname":"<site>.<zone>","service":"<site>","zone_id":"<zone_id>"}'
```

The token needs **zone DNS:Edit** in addition to the Workers scopes (see
`references/project-setup.md` Preflight #3).
