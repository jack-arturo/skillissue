# skillissue — agent notes

## What this is

Public home for Jack Arturo's personal/agent skills collection.
Live at <https://skillissue.sh>. Typo alias: <https://skilissue.sh>.

AutoMem slug: bare tag `skillissue`.

## Layout

| Path | Purpose |
|---|---|
| `content/skills/*.md` | Authored public narratives (SSOT for *story*, not package bytes) |
| `content/story/` | About / product-story pages |
| `catalog/denylist.txt` | Skills that must never appear publicly |
| `catalog/vault-index.json` | Generated vault inventory (may be gitignored) |
| `scripts/` | `inventory-vault.mjs`, `build-catalog.mjs` |
| `functions/` | Cloudflare Pages Functions (lead capture) |
| `schema/` | D1 lead-capture schema |
| `site/` | **Generated** Pages output + static assets |
| `templates/` | HTML templates for the generator |

AutoVault (`~/.autovault/skills`) remains SSOT for skill *packages*. This site never dumps full SKILL.md bodies or machine paths.

## Build

```bash
npm run inventory   # scan ~/.autovault/skills → catalog/vault-index.json
npm run build       # merge vault + content → site/
```

## Deploy

GitHub-connected Cloudflare Pages project `skillissue`:

- Production branch: `main`
- Build command: `npm ci && npm run build` (after generator lands)
- Build output directory: `site`
- Domains: `skillissue.sh`, `www.skillissue.sh`, `skilissue.sh`, `www.skilissue.sh`

```bash
git push origin main
```

Do **not** run `wrangler pages deploy` against this project — it is GitHub-connected.

## Public catalog rules

1. **Visibility** — only `visibility: public` content files ship. Default for vault-only skills is hidden until narrative exists.
2. **Uniqueness gate** — public skills need authored Why/History/How-used **or** explicit `provenance: upstream|mixed` with origin note. Vault description scrape alone is not enough.
3. **Denylist** — `catalog/denylist.txt` plus internal-named skills (e.g. `cli-import-autohub`).
4. **Provenance badges** — `house` | `upstream` | `mixed` on every skill page.
5. **No leaks** — scrub `/Users/`, secrets, admin tokens; never commit `.dev.vars` secrets.

## Voice

Use `jacks-writing-style` for all public prose. Dry, technical, lightly dry-humored. The "skill issue" pun is buried — never billboarded.

## Product links

- AutoVault: https://autovault.dev
- AutoMem: https://automem.ai
- AutoHub / Jack: Very Good Plugins ecosystem

## Email / lead capture

Pages Functions + D1 + Resend via `cloudflare-lead-capture`. Preview must not write production D1. Secrets via wrangler only — never paste into chat or commit.
