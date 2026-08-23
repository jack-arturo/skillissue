# AutoVault Identity

## Brand Scope

AutoVault is the public brand for this system. Keep the name direct and do not
substitute another parent-brand label in public
surfaces unless the user explicitly asks for a separate historical note.

## Core Idea

AutoVault presents agent skills as reviewed, signed, portable capability
bundles. The identity should feel precise, secure, inspectable, and lively
enough to showcase automation without turning into generic cyberpunk.

## Palette

Use these tokens as the default source of truth:

| Token | Value | Role |
|---|---:|---|
| `--av-bg` | `#0b1014` | page background and deep charcoal surfaces |
| `--av-bg-2` | `#0f161c` | secondary bands and elevated dark surfaces |
| `--av-panel` | `#131c24` | compact panels, tool wells, cards |
| `--av-line` | `#1f2c37` | default borders and separators |
| `--av-line-strong` | `#283744` | active borders and stronger dividers |
| `--av-ink` | `#e6edf3` | primary text on dark |
| `--av-ink-2` | `#aab8c5` | secondary text |
| `--av-ink-3` | `#6e8090` | captions and disabled text |
| `--av-mint` | `#5ad6c0` | active state, vault stroke, success/admitted signal |
| `--av-mint-soft` | `rgba(90, 214, 192, 0.12)` | soft mint fills and halos |
| `--av-warn` | `#e8a866` | pending or needs-review state |
| `--av-bad` | `#d97171` | blocked or rejected state |
| `--av-blue` | `#5a9dd6` | Codex or information accent |
| `--av-violet` | `#b48ad6` | secondary agent or provenance accent |

Use mint sparingly. Mint is the signal color, not the full theme. Charcoal,
ink, line, and neutral surfaces should carry most of the interface.

## Type

- Interface text: Inter.
- Code, terminal, manifests, hashes, and micro-labels: JetBrains Mono.
- Editorial or launch emphasis: Instrument Serif, used selectively and never
  inside dense controls.
- Micro-labels should be short, mono, and compact. Keep letter spacing at `0`
  unless the surrounding design system already defines another value.

## Mark Anatomy

The canonical mark is a simplified vault:

- Rounded rectangular body.
- Two short bottom stubs.
- Center dial in locked/readable states.
- Optional dashed inner outline or depth hint for unlocked/read-path states.
- Mint stroke on charcoal by default.

Keep the body, stubs, and dial recognizable even at small sizes. In tight
contexts the mark may lose glow, dashed depth, and interior detail, but it
should not lose the vault silhouette.

## Voice

Use clear product language: reviewed, signed, synced, admitted, staged,
trusted, portable, inspectable. Avoid inflated claims and vague AI magic. The
brand can be playful in mascot contexts, but the product voice stays practical.

## Layout

- Prefer dense, inspectable layouts over oversized marketing cards for app
  surfaces.
- Use cards only for repeated items, modals, and genuinely framed tools.
- Let dark bands and constrained inner content define sections.
- Keep text within its container at mobile and desktop sizes.

## Accessibility

- Maintain contrast on charcoal backgrounds.
- Provide a non-animated state for every animated mark or loader.
- Do not rely on color alone for lock, admit, reject, or pending states.
- Avoid tiny text inside SVG marks unless the target asset is large enough for
  real reading.
