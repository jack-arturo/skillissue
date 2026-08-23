# Surface Adaptation

This reference explains how to keep AutoVault recognizable across media with
different rendering constraints.

## Web SVG

- Use `assets/brand-mark.svg` for small static UI marks.
- Use `assets/brand-mark-animated.svg` for hero, loading, or showcase moments.
- Keep SVG self-contained: inline styles, no external fonts, no remote images.
- Preserve the rounded vault body, bottom stubs, and dial.
- Include a `<title>` and `<desc>` when embedding the SVG directly.
- Use `prefers-reduced-motion` inside the SVG when animation is shipped.

## Web CSS

- Start from `assets/autovault-brand.css`.
- Apply token classes rather than hardcoding mint across every element.
- Use `.av-state-scan`, `.av-state-admit`, `.av-state-open`, and
  `.av-state-held` as semantic state hooks.
- Keep icon buttons and fixed-format controls dimensionally stable.

## Terminal And ASCII

- Use only ASCII for broad terminal support unless the project already uses
  Unicode box drawing.
- Prefer the vault silhouette over facial detail.
- Show state through frame progression, labels, and single-character changes.
- Pair colorized output with text labels such as `SCAN`, `ADMIT`, `LOCKED`, or
  `HELD` so monochrome terminals still work.

## TUI

- The mark should fit in a fixed-width area so status changes do not resize the
  layout.
- Use JetBrains Mono or the terminal default mono.
- Keep animations to low-frequency frame changes; do not flood terminal output.
- Use mint for active/admitted rows, warning for pending review, and red for
  blocked states.

## Mascot, Raster, And Friendly Marketing

- The mascot may add a face, small arms, side handle, and soft dimensional
  shading, but the body must still read as the AutoVault mark.
- Keep charcoal and mint as the main brand relationship.
- Do not rely on generated text inside the image. Add type in layout tools.
- Use `assets/mascot-prompt.md` as art direction. The checkout mascot draft is
  only reference material and should not become the canonical logo.

## Social And Docs Images

- Make the vault mark a first-viewport signal.
- Use real UI, product state, or generated bitmap texture as the visual anchor
  rather than abstract gradients.
- Keep title text outside the mark.
- Export at the target size and inspect small-text legibility.

## Video

- Use the scan, admit, settle rhythm from `references/motion.md`.
- Let glow and scan lines carry movement; keep camera moves restrained.
- When showing a mascot, treat it as host or guide, not a replacement logo.
- Avoid frame-by-frame dependency on tiny text or fine SVG strokes.

## Hosted Checkout

Hosted checkout remains raster constrained. Use raster PNG output for that
surface and keep SVG brand assets as source inspiration only. Do not assume the
checkout host will animate or load the SVG mark.
