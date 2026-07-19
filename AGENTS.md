# skillissue — agent notes

## What this is

Public home for Jack Arturo's personal/agent skills collection.
Live at <https://skillissue.sh>.

AutoMem slug: bare tag `skillissue`.

## SSOT

| Path | Role |
|---|---|
| `skills/<name>/SKILL.md` (+ resources) | **Installable package** — GitHub is the publisher |
| `skills/<name>/story.md` | Public narrative for the site (Why / History / How) |
| `content/story/` | About / install / changelog only |
| `site/` | Generated Pages output |

Do **not** publish by editing only `~/.autovault/skills` and hoping an export runs. Edit `skills/<name>/` in this repo, push, install from git.

Install pattern:

```bash
autovault add jack-arturo/skillissue@<sha>:skills/<name>/SKILL.md --sync-profiles
```

`<sha>` is the build commit (shown on skill pages).

## Build

```bash
npm run build          # skills/* → site/ (no local vault required)
npm run build:strict   # fail on missing narratives
```

## Deploy

GitHub-connected Pages project `skillissue`:

- Build: `npm run build`
- Output: `site`
- Domains: `skillissue.sh`, `www.skillissue.sh` (typo catch may exist silently — do not market it)

```bash
git push origin main
```

Do **not** `wrangler pages deploy` against this project.

## Email

D1 `skillissue-leads` bound as `LEAD_DB`. Secrets: `RESEND_API_KEY`, `ADMIN_TOKEN`, `CONFIRM_SECRET`.  
From address uses verified Resend domain until skillissue.sh is verified.

## Voice

`jacks-writing-style` for public prose. Buried pun, never billboarded.
