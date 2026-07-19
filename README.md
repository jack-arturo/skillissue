# skillissue.sh

Jack Arturo's personal/agent skills collection — public narratives for skills that
earn their keep across Claude Code, Codex, Cursor, and AutoHub.

**Live:** <https://skillissue.sh>

Packages live in [AutoVault](https://autovault.dev). Memory lives in [AutoMem](https://automem.ai).
This site is the shelf — not a registry.

## Layout

| Path | What |
|---|---|
| `content/skills/` | Authored public skill narratives (required for a public page) |
| `content/story/` | About / install / changelog source |
| `catalog/` | denylist, vault-index (committed for CI), build report |
| `scripts/` | inventory + catalog generator |
| `functions/` | Pages Functions lead-capture (D1 + Resend when bound) |
| `site/` | Generated Cloudflare Pages output |

## Develop

```bash
npm run inventory   # requires local ~/.autovault/skills — refresh vault-index.json
npm run build       # content + vault-index → site/
npm run preview     # http://127.0.0.1:8787
```

Public skills need a `content/skills/<name>.md` with Why/History/How (or explicit upstream origin).
Bare vault scrape alone will not publish.

## Deploy

GitHub-connected Pages project `skillissue`:

- Build command: `npm run build`
- Output directory: `site`
- Push `main` → production

Do **not** `wrangler pages deploy` against this project.

## Email list

Lead-capture Functions are in-repo. **D1 binding pending** (account at free-tier D1 cap).
See [README.lead-capture.md](./README.lead-capture.md).

## License

MIT — see [LICENSE](./LICENSE).
