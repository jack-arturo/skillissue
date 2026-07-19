# skillissue — agent notes

## What this is

Public home for Jack Arturo's personal/agent skills collection.
Live at <https://skillissue.sh>. Typo alias: <https://skilissue.sh>.

## Layout

| Path | Purpose |
|---|---|
| `site/` | Cloudflare Pages source (static, no build). Output dir for Pages. |
| `site/skills.json` | Machine-readable skill catalog. |
| `site/llms.txt` | Agent-oriented summary for crawlers. |

## Deploy

GitHub-connected Cloudflare Pages project `skillissue`:

- Production branch: `main`
- Build command: *(blank)*
- Build output directory: `site`
- Domains: `skillissue.sh`, `www.skillissue.sh`, `skilissue.sh`

```bash
git push origin main
```

Do **not** run `wrangler pages deploy` against this project once GitHub is connected.

## Voice

Public copy should stay dry, technical, and a little dry-humored. The "skill issue" pun is buried — never billboarded. Prefer showing install commands and real skill descriptions over marketing fluff.
