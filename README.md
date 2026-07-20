# skillissue.sh

Jack Arturo's personal/agent skills — packages on GitHub, install with AutoVault.

**Live:** <https://skillissue.sh>

## Source of truth

```
skills/<name>/SKILL.md   # installable package (+ resources)
skills/<name>/story.md   # public narrative for the site
```

The site is generated from that tree on every push. AutoVault installs the **same** paths:

```bash
autovault add jack-arturo/skillissue@<sha>:skills/<name>/SKILL.md --sync-profiles
```

## Develop

```bash
npm run build          # skills/* → site/
npm run build:strict
npm run preview        # :8787
```

## Deploy

### Catalog (Pages)

GitHub-connected Cloudflare Pages (`skillissue`): build `npm run build`, output `site/`.

```bash
git push origin main
```

### Essays (EmDash Worker — hybrid)

Long-form lives under `blog/` as **Astro + EmDash** (Workers, not Pages). Figures plugin copied from AutoMem; layout patterns from South & Ozarks.

| Surface | Owner |
|---|---|
| `/`, `/skills/`, `/install/`, lead capture | Pages |
| `/essays/*`, `/_emdash/*` (after zone routes) | Worker `skillissue-blog` |

```bash
npm run blog:seed      # essays md + charts → blog/seed/seed.json
npm run blog:build
npm run blog:deploy    # wrangler deploy
```

**Live Worker (pre-route):** https://skillissue-blog.very-good-plugins.workers.dev  
**Admin setup (one-time, browser):** `/_emdash/admin/setup`  
Full notes: [`blog/README.md`](blog/README.md).

Until zone routes are attached, the static Pages essay at `/essays/...` remains the public URL. After setup + seed + routes, EmDash takes `/essays/*`.

## Email list

D1 `skillissue-leads` (`LEAD_DB`) + Resend. See `README.lead-capture.md`.  
Separate D1 `skillissue-cms` + R2 `skillissue-media` are for the essay Worker only.

## License

MIT
