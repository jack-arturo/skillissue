# Contributing

## Branching

- Branch from `main` as `feat/*`, `fix/*`, or `docs/*`.
- Open a PR with `gh pr create`.
- Squash-merge to `main`. Cloudflare Pages deploys `main` automatically.

## Commits

Conventional commits preferred: `feat:`, `fix:`, `docs:`, `chore:`.

## Site changes

Edit files under `site/`. No build step — open `site/index.html` in a browser to preview.

When adding a skill to the catalog, update both:

1. `site/skills.json` (source of truth for the grid + agents)
2. The featured cards in `site/index.html` if it belongs on the hero shelf
