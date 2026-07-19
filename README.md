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

GitHub-connected Cloudflare Pages (`skillissue`): build `npm run build`, output `site/`.

```bash
git push origin main
```

## Email list

D1 `skillissue-leads` (`LEAD_DB`) + Resend. See `README.lead-capture.md`.

## License

MIT
