# AutoVault Motion

AutoVault motion should communicate state: scan, read path, admit, lock, sync,
or handoff. The default feel is controlled and technical, with a little warmth
from easing and glow.

## Motion Tokens

| Token | Value | Use |
|---|---:|---|
| `--av-ease` | `cubic-bezier(0.4, 0, 0.2, 1)` | general UI transitions |
| `--av-ease-lock` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | dial close and accepted lock-in |
| `--av-dur-fast` | `120ms` | hover, focus, button state |
| `--av-dur-base` | `220ms` | panel and mark state transitions |
| `--av-dur-slow` | `400ms` | reveal, admit, and route handoff |
| `--av-cycle` | `4.4s` | SVG brand-mark loop |
| `--av-scan` | `1.1s` | scan/read-path sweep |

## Canonical States

### Idle

The vault rests closed with a soft mint halo. If animated, the halo breathes on
the `4.4s` cycle with opacity moving between about `0.7` and `1`.

### Scan

A scan is a thin mint line or soft sheen crossing a panel, manifest block, or
vault interior. It runs for about `1.1s` and should read as inspection, not as a
loading spinner. In terminal output, scan becomes frame progression.

### Read Path

Read-path motion suggests safe inspection. Use a dashed inner outline, slight
horizontal row translation, or a subtle highlight moving through code rows.

### Admit

Admit is the lock-in moment: the dial scales into place, opacity reaches `1`,
and an optional ring pulse expands then fades. Keep it short and decisive.

### Unlock

Unlock removes the dial, reveals the dashed inner depth, or rotates a lid/door
hint only when the surface can support the detail. Avoid literal wide-open doors
in small icons because they weaken the silhouette.

### Reject Or Hold

Use warning or error accent colors with steady motion. Do not use bounce,
confetti, or success-style glow for blocked states.

## Interaction Triggers

| Trigger | Response |
|---|---|
| Hover or focus on an interactive mark | Stroke brightens, halo appears, dial remains stable |
| Skill staged for review | Scan sweep across manifest or vault interior |
| Skill admitted | Dial scales in, ring pulse expands, final state rests closed |
| Skill unavailable | Dial remains closed, border shifts to warning or error token |
| Agent handoff | Two or three short path highlights, then stable admitted state |

## Reduced Motion

Respect `prefers-reduced-motion: reduce`.

- Disable infinite loops.
- Replace scan sweeps with a static highlighted line.
- Replace dial scale with an immediate visible state.
- Keep hover/focus affordances through color, border, or opacity changes.
- Never require animation to understand the state.

## Video Timing

For short demos or launch bumpers, use a three-beat pattern:

1. Scan: `0.0s-1.1s`.
2. Admit: `1.1s-1.5s`.
3. Settle: `1.5s-2.4s`.

Loopable brand bugs can use the full `4.4s` cycle from the animated SVG.
