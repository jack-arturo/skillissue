---
name: docs-screenshot-packager
description: Capture, package, optimize, verify, and place documentation screenshots for GitHub READMEs, repo docs, and marketing/docs sites. Use for release screenshot passes, visual docs updates, screenshot QA, and reusable screenshot workflows across repos.
license: MIT
tags: [screenshots, docs, readme, github, marketing, visual-qa]
agents: [claude-code, codex, autojack]
category: docs
metadata:
  version: "1.0.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Node, Read, Edit, Write]
resources:
  - path: agents/openai.yaml
    type: file
  - path: scripts/package-screenshots.mjs
    type: file
  - path: scripts/verify-screenshot-pack.mjs
    type: file
  - path: references/github-readme.md
    type: file
  - path: references/marketing-site.md
    type: file
  - path: references/capture-recipes.md
    type: file
  - path: examples/github-readme.manifest.json
    type: file
  - path: examples/marketing-site.manifest.json
    type: file
---

# Docs Screenshot Packager

Use this skill when a repo needs documentation screenshots captured, framed,
optimized, verified, and placed safely in GitHub READMEs, repo docs, or
marketing/docs sites.

## Workflow

1. Discover the target surface before creating assets.
   - GitHub/repo docs are the default. Read README, docs folders, existing
     image paths, `.gitignore`, package scripts, and recent screenshot
     conventions.
   - For marketing/docs sites, inspect the framework and public asset
     conventions. Read `references/marketing-site.md` when the repo has
     Astro/Starlight, Next, or a public docs site.
   - Use `references/github-readme.md` for README placement and PR/Copilot
     expectations.

2. Capture or select source screenshots.
   - Keep raw/proof captures in scratch until approved.
   - For public or local web pages, use Playwright, the Browser plugin, or the
     in-app browser. For authenticated SaaS dashboards, use `dev-browser`.
   - Read `references/capture-recipes.md` before capture planning, WebGL/canvas
     QA, token handling, or product-state selection.

3. Create a small manifest for the output pack.
   - Use `mode: "github-readme"` unless the task is explicitly scratch-only or
     a marketing/docs site.
   - Use `mode: "release-pack"` for approval packages that must not write into
     repo-tracked docs.
   - Default committed UI screenshots to 1200px-wide optimized PNGs.

```json
{
  "mode": "github-readme",
  "sourceDir": "/tmp/screenshot-proof",
  "outputDir": "docs/img",
  "defaultWidth": 1200,
  "format": "png",
  "optimize": "palette",
  "frame": { "enabled": true, "radius": 8, "border": true, "shadow": "subtle" },
  "screenshots": [
    {
      "id": "graph-viewer-overview",
      "source": "graph-viewer-overview.raw.png",
      "output": "graph-viewer-overview.png",
      "alt": "AutoMem Graph Viewer overview with memory graph, search, stats, and timeline controls",
      "maxBytes": 800000
    }
  ]
}
```

4. Package screenshots with the bundled script.

```bash
node ~/.autovault/skills/docs-screenshot-packager/scripts/package-screenshots.mjs \
  --manifest ./screenshot-pack.manifest.json \
  --report ./screenshot-pack.report.json
```

5. Verify before editing docs or claiming success.

```bash
node ~/.autovault/skills/docs-screenshot-packager/scripts/verify-screenshot-pack.mjs \
  --manifest ./screenshot-pack.manifest.json \
  --markdown README.md \
  --report ./screenshot-pack.verify.json
```

   - Pass `--token "$TOKEN"` only for byte-level audits; never write tokens into
     manifests, filenames, reports committed to repos, or metadata meant for docs.
   - Verification must pass for dimensions, entropy/nonblank checks, byte limits,
     token-byte checks, unsafe text patterns, and local Markdown image paths.

6. Update docs sparsely after assets pass QA.
   - Use overview screenshots first.
   - Add feature-state screenshots only when they prove product behavior or reduce
     setup confusion.
   - Run the repo's documented checks. For PRs, expect review feedback on image
     weight and keep committed screenshot payload modest.

## Script Interface

- `package-screenshots.mjs --manifest <file> [--report <file>]`
  writes optimized outputs and a JSON report.
- `verify-screenshot-pack.mjs --manifest <file> [--markdown <file>...]`
  verifies outputs and local Markdown image references.

The scripts use Sharp when available. In Codex desktop they automatically try the
bundled workspace dependency path before failing with an install hint.

## Output

Return a concise status with:

- Target mode and destination directory.
- Generated image names, dimensions, byte sizes, and total payload.
- Markdown/docs files updated.
- Verification commands and results.
- Visual QA notes, redactions, and any remaining risk.

## Anti-patterns

- Do not commit raw/proof screenshots by default.
- Do not fake browser chrome except for explicit README hero or landing assets.
- Do not skip visual inspection because automated entropy checks passed.
- Do not include secrets, tokens, private account data, PII, or dashboard IDs in
  screenshots, filenames, manifests, or reports.
- Do not update marketing claims without checking repo truth and user intent.
- Do not pack every screen. Sparse screenshots are better documentation.
