---
name: autovault-brand-system
description: Apply the AutoVault brand system across web SVG, terminal ASCII, illustrated mascot, social asset, and video-oriented surfaces when creating or adapting AutoVault-branded UI, docs, demos, or marketing visuals.
license: MIT
tags: [autovault, brand, design, motion, svg, ascii, mascot, demo]
agents: [claude-code, codex, autojack]
category: brand
metadata:
  version: "0.1.0"
tools_required: [Read, Edit, Write]
capabilities:
  network: false
  filesystem: readwrite
  tools: [Read, Edit, Write]
resources:
  - path: story.md
    type: file
  - path: agents/openai.yaml
    type: file
  - path: references/identity.md
    type: file
  - path: references/motion.md
    type: file
  - path: references/surface-adaptation.md
    type: file
  - path: assets/brand-mark.svg
    type: file
  - path: assets/brand-mark-animated.svg
    type: file
  - path: assets/autovault-brand.css
    type: file
  - path: assets/ascii-vault.txt
    type: file
  - path: assets/mascot-prompt.md
    type: file
  - path: assets/usage-examples.md
    type: file
---

# AutoVault Brand System

Use this skill when an agent needs to create or adapt AutoVault-branded
interfaces, docs, terminal experiences, marketing stills, mascot prompts, or
motion assets from one canonical brand source.

## When to use

- The user asks for an AutoVault-branded surface, demo, README asset, social
  card, video bumper, checkout visual, terminal prompt, or iconography pass.
- A project already uses the AutoVault vault mark and needs consistent colors,
  type, motion, interaction responses, or reduced-motion behavior.
- A surface has strict rendering constraints such as SVG-only web output,
  terminal ASCII, raster illustration, or video-safe animation.

## Workflow

1. Identify the target surface: web SVG/CSS, terminal ASCII/TUI, static docs,
   social/raster, mascot illustration, or video-style motion.
2. Load `references/identity.md` first. Keep AutoVault as the canonical brand
   scope.
3. Load `references/motion.md` whenever animation, interaction states, hover
   behavior, reveal timing, or reduced-motion behavior is involved.
4. Load `references/surface-adaptation.md` when translating the mark across
   constrained media such as SVG, terminal ASCII, raster images, video, and
   hosted checkout contexts.
5. Reuse or adapt the files under `assets/`:
   - `brand-mark.svg` for static web or document marks.
   - `brand-mark-animated.svg` for SVG-native motion demos.
   - `autovault-brand.css` for tokens, state classes, and keyframes.
   - `ascii-vault.txt` for terminal-safe mark and loader frames.
   - `mascot-prompt.md` for friendly raster/video mascot prompt direction.
   - `usage-examples.md` for copy-paste implementation recipes.
6. Validate the result against the surface constraints: no text overlap, clear
   contrast on charcoal, stable mark anatomy, reduced-motion fallback, and no
   asset path or network dependency that the target environment cannot load.

## Output

Produce the smallest useful artifact for the user's surface:

- A patched SVG/CSS component for web UI.
- ASCII frames or a TUI-safe loader treatment for terminal contexts.
- A prompt and art-direction checklist for mascot, social, or video generation.
- A short implementation note explaining which brand tokens, mark state, and
  motion state were used.

## Brand Rules

- The public brand is AutoVault.
- The canonical mark is a rounded vault body with two bottom stubs and a dial
  that communicates locked, unlocked, scan, or admitted state.
- The primary environment is charcoal with mint `#5ad6c0` as the active signal.
- Use Inter for interface text, JetBrains Mono for terminal/code/micro-labels,
  and Instrument Serif only for selective editorial emphasis.
- Motion should feel like scanning, admitting, syncing, or locking. Avoid
  springy celebration unless the product moment is explicitly successful.
- Treat `assets/mascot-checkout-logo-draft.png`, when present in a project, as
  reference material only. It is not a canonical source asset.

## Anti-patterns

- Do not add an unrelated parent-brand lockup.
- Do not replace hosted checkout raster constraints with SVG-only assumptions.
- Do not make the mascot draft PNG canonical or require it as an input.
- Do not use mint as the only color in every surface; charcoal, ink, warning,
  blue, violet, and error accents have specific jobs.
- Do not ship looping motion without a reduced-motion fallback.
