# Contributing

## Branching

- Branch from `main` as `feat/*`, `fix/*`, or `docs/*`.
- Open a PR with `gh pr create`.
- Merge release PRs with a **merge commit**, never squash them. The immutable
  package-source commit must remain reachable from `main`. Cloudflare Pages
  deploys `main` automatically.

## Commits

Conventional commits preferred: `feat:`, `fix:`, `docs:`, `chore:`.

## Site changes

`skills/` is the public-package source of truth. `site/` is generated output; do not hand-edit it.

When you change anything under `skills/`, make a package-only commit first.
The build refuses dirty or untracked `skills/` paths because every generated
install/source URL must pin a committed skill-tree revision. After that commit,
run:

```bash
npm test
npm run build:strict
npm run build
```

Review and commit the generator/tests/docs changes plus the resulting `site/`,
`catalog/report.json`, and `catalog/autovault-sync.json` in a later commit. Do
not amend or squash away the earlier package commit.

When adding a skill to the catalog, update both:

1. `skills/<name>/SKILL.md` (the installable package) and `skills/<name>/story.md` (the public narrative)
2. `catalog/autovault-publication.json` (explicit public visibility)
