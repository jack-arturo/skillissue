# Marketing And Docs Site Mode

Use this reference when screenshots are intended for a public marketing site or
hosted docs such as Astro/Starlight, Next, or static docs.

## Discovery

- Astro/Starlight usually stores docs in `src/content/docs` and public assets in
  `public/`.
- Next projects usually store public images in `public/` and docs/routes under
  `app/`, `pages/`, or content collections.
- Prefer existing `public/screenshots/`, `public/img/`, or `public/images/`
  conventions. If none exists, use `public/screenshots/`.
- Update docs pages, not the source repo README, unless explicitly requested.

## Placement

- Use screenshots where they clarify a product feature, install step, or
  deployment topology.
- Avoid turning every text step into an image. Sparse screenshots age better.
- Keep marketing copy truthful and source-backed. Do not add product claims
  because they look good beside a screenshot.

## Verification

- Run the site build command documented in `AGENTS.md`, README, or package
  scripts. For AutoMem website, use `npm run build`, not direct framework
  build commands.
- Run link checks when available after build.
- Verify public image paths match the site router. Leading `/screenshots/...`
  references resolve from `public/screenshots/...`.

## Authenticated Dashboards

- Use `dev-browser` for authenticated dashboards or already-open real Chrome
  sessions.
- Redact service IDs, account IDs, private URLs, tokens, emails, and billing
  information before packaging.
