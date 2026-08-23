# Usage Examples

## Web SVG Mark

Use the static mark in navigation, catalog cards, docs badges, or small toolbar
spots:

```html
<span class="av-brand-mark" aria-hidden="true">
  <!-- inline assets/brand-mark.svg here -->
</span>
```

Use the animated mark only when motion communicates state, such as scanning or
admission:

```html
<div class="av-panel av-state-scan">
  <!-- inline assets/brand-mark-animated.svg here -->
</div>
```

## CSS State Hooks

```html
<section class="av-surface">
  <div class="av-panel av-state-admit">
    <span class="av-micro-label">Admitted</span>
    <strong>autovault-brand-system</strong>
  </div>
</section>
```

## Terminal Loader

Use a fixed-width area and replace frames in place when the terminal supports
it. In simple logs, print only the final state and a text label:

```text
[SCAN]  autovault-brand-system
[ADMIT] autovault-brand-system
[LOCKED] signed bundle ready
```

## Mascot Or Social Prompt

Start from `assets/mascot-prompt.md`, then append the campaign context, crop,
and output size. Keep generated text out of the image and add final copy in the
layout tool.

## Video Bumper

Use this timing:

```text
0.0s-1.1s  scan sweep through vault interior
1.1s-1.5s  dial closes with lock easing
1.5s-2.4s  glow settles, title or UI appears beside the mark
```

For reduced-motion cuts, use the final locked frame with a static mint edge
highlight.
