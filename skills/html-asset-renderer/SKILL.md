---
name: html-asset-renderer
description: Render fixed-size HTML/CSS design exports into production raster assets when users need social cards, favicons, docs images, app-store screenshots, or other web-rendered artwork captured, dimension-checked, and prepared for merge.
license: MIT
tags: [html, screenshots, social-assets, visual-qa, design-handoff, social]
agents: [claude-code, codex, autojack]
category: design
metadata:
  version: "1.0.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Node, Read, Edit, Write]
resources:
  - path: scripts/render-html-assets.mjs
    type: script
bin:
  render:
    command: scripts/render-html-assets.mjs
    description: Render fixed-size HTML assets from a directory or manifest.
    requires-tty: false
---

# HTML Asset Renderer

Use this skill when a user has HTML/CSS design exports that should become
production raster assets: Open Graph cards, Twitter/X cards, GitHub social
previews, favicons, docs images, app-store screenshots, campaign images, or
other fixed-size artwork rendered in the browser.

## When to use

- The user gives a folder of `.html` files and asks for screenshots at exact
  dimensions.
- The source has a fixed canvas element such as `.canvas`, `.artboard`,
  `[data-render-asset]`, or a named asset wrapper.
- The output needs production checks: exact width and height, file size,
  metadata merge notes, and visual QA.
- The user asks to turn a Claude Design, Figma-to-HTML, or hand-authored
  HTML export into static image assets.

## Workflow

1. Inspect the source folder first.
   - List HTML files and supporting CSS/assets.
   - Identify the target selector; prefer `.canvas`, then
     `[data-render-asset]`, then a manifest-provided selector.
   - Look for stale product copy, fake metrics, placeholder paths, and
     platform-specific crop requirements.

2. Create a render manifest when output names or dimensions matter.
   - Use JSON with an `assets` array.
   - Each item may define `source`, `output`, `width`, `height`, `selector`,
     `format`, and `maxBytes`.
   - Keep brand/product copy in the project source, not in this generic skill.

3. Render with the bundled script.
   - Find the script with `autovault skill which html-asset-renderer render`
     or use the installed resource path directly.
   - Use system Chrome by default; set `CHROME_PATH` or pass `--chrome` when
     needed.

```bash
node ~/.autovault/skills/html-asset-renderer/scripts/render-html-assets.mjs \
  ./source-html ./public \
  --manifest ./social-assets.manifest.json \
  --selector .canvas \
  --report ./social-assets.report.json
```

4. Verify and merge.
   - Confirm every generated PNG exists at the expected dimensions.
   - Check file sizes against platform limits.
   - Update the project metadata that points at the assets.
   - Run the repo's normal tests/builds.
   - Visually inspect native-size outputs before handoff.

## Manifest shape

```json
{
  "assets": [
    {
      "source": "og-1200x630.html",
      "output": "og-1200x630.png",
      "width": 1200,
      "height": 630,
      "selector": ".canvas",
      "maxBytes": 1000000
    }
  ]
}
```

If no manifest is provided, the renderer scans the input directory for `.html`
files except `index.html`, captures the target selector, and writes
`<source-basename>.png`.

## Output

Return a concise checklist:

- Source folder and output folder.
- Generated asset names with dimensions and byte sizes.
- Any skipped source files and why.
- Metadata or route files that should point at the new assets.
- Visual QA notes and remaining risk.

## Anti-patterns

- Do not bundle project-specific brand files or copy into this skill.
- Do not ship stale source screenshots as production assets; render from the
  editable HTML/CSS source.
- Do not claim success without exact dimension verification.
- Do not rewrite product positioning inside the generic workflow; make those
  edits in the project source before rendering.
- Do not create destructive cleanup steps. Only write to the requested output
  directory and report path.
- Do not store secrets, tokens, or private account data in manifests, reports,
  or generated assets.
