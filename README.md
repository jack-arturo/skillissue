# skillissue.sh

Jack Arturo's personal/agent skills collection — the public home for skills that
actually earn their keep across Claude Code, Codex, Cursor, and AutoHub.

**Live:** <https://skillissue.sh>

The domain is a buried pun ("skill issue") that also reads as shell (`.sh`).
If you noticed, good. If you didn't, still good — the install commands work either way.

## Layout

| Path | What |
|---|---|
| `site/` | Cloudflare Pages source for skillissue.sh. Static HTML, no build step. |
| `site/skills.json` | Machine-readable catalog. |
| `site/llms.txt` | Short agent-facing summary. |

## Deploy

Cloudflare Pages project `skillissue` is GitHub-connected
(`jack-arturo/skillissue`, production branch `main`):

- Framework preset: **None**
- Build command: *(blank)*
- Build output directory: `site`

```bash
git push origin main
```

Custom domains: `skillissue.sh`, `www.skillissue.sh`, and the typo catch
`skilissue.sh`.

Do **not** run `wrangler pages deploy` against this project — it is
GitHub-connected; direct uploads create split-brain deploys.

## Local preview

```bash
cd site && python3 -m http.server 8787
# open http://127.0.0.1:8787
```

## License

MIT — see [LICENSE](./LICENSE).
