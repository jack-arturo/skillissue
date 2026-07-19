# GitHub README Mode

Use this reference when screenshots are intended for a repository README or
repo-local docs.

## Discovery

- Read README and existing docs image references before writing files.
- Prefer an existing image directory. If none exists, use `docs/img/`.
- Check `.gitignore` so generated assets are not accidentally ignored.
- Read package scripts and run focused checks after docs edits.

## Placement

- Put one overview screenshot near the top after the project description.
- Use a small table or short section for secondary feature states.
- Keep screenshots sparse; every image should prove product state or reduce
  setup confusion.
- Write precise alt text that describes the product state, not the framing.

## Asset Policy

- Do not commit raw/proof captures by default.
- Commit optimized docs variants. For UI screenshots, default to 1200px-wide
  palette PNGs.
- Keep total README screenshot payload modest. Copilot and reviewers commonly
  flag multi-megabyte PNG sets.
- Use fake browser chrome only for explicit README hero or landing-page assets.

## PR Notes

- Mention image dimensions and total payload in the PR body when screenshots are
  added.
- If Copilot flags asset size, prefer resizing/optimizing over switching format
  unless the repo already uses WebP.
