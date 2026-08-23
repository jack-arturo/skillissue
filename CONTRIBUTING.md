# Contributing

## Branching

- Branch from `main` as `feat/*`, `fix/*`, or `docs/*`.
- Open a PR with `gh pr create`.
- Squash-merge to `main`. Cloudflare Pages deploys `main` automatically.

## Commits

Conventional commits preferred: `feat:`, `fix:`, `docs:`, `chore:`.

## Site changes

`skills/` is the public-package source of truth. `site/` is generated output; do not hand-edit it.

When you change a public package narrative or catalog metadata, run:

```bash
npm test
npm run build:strict
npm run build
```

Review and commit the resulting `site/`, `catalog/report.json`, and `catalog/autovault-sync.json` changes with the source edit.

When adding a skill to the catalog, update both:

1. `skills/<name>/SKILL.md` (the installable package) and `skills/<name>/story.md` (the public narrative)
2. `catalog/autovault-publication.json` (explicit public visibility)
