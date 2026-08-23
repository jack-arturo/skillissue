---
name: bubble-tea-tui-builder
description: Build, test, and harden Go Bubble Tea terminal user interfaces with replayable events, responsive rendering, and terminal-safe fallbacks.
license: MIT
tags: [tui, terminal, bubble-tea, go, testing, graphics]
agents: [codex]
category: terminal
metadata:
  version: "1.1.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit, Write]
requires-secrets: []
resources:
  - path: story.md
    type: file
---

# Bubble Tea TUI Builder

## When To Use

Use this skill when building or improving a standalone terminal UI in Go,
especially with Bubble Tea, Bubbles, Lip Gloss, local JSONL/Unix-socket
bridges, PTY tests, fixture replay, audio-level meters, latency strips, or
iTerm2 graphics fallbacks.

The goal is a reliable terminal product, not a browser dashboard or React/Ink
patch.

## Core Defaults

1. Build the runtime boundary first: TUI state comes from a structured event
   stream, not stdout scraping.
2. Keep Bubble Tea `Model`, `Update`, and `View` pure enough to test with
   fixture messages.
3. Coalesce high-frequency events before they become layout work. Mic/VAD
   levels should render around 10Hz unless the user explicitly needs more.
4. Keep the terminal readable when graphics are unavailable. Every image or
   rich visual must have a text fallback.
5. Prefer bounded histories: transcript turns, timeline entries, diagnostics,
   and waveform samples must have caps.
6. Use one canonical event schema and command schema; do not invent one-off
   payloads per component.
7. Treat visual verification as part of the work. Text replay and passing unit
   tests are not enough to claim a TUI looks good.

## Architecture Pattern

Use these packages unless the repo already has stronger conventions:

- `cmd/<binary>/main.go`: CLI argument parsing and process exit.
- `internal/protocol`: event and command envelopes, JSONL encode/decode.
- `internal/bridge`: child process launcher, Unix-socket/TCP bridge, command
  round trips.
- `internal/cockpit`: Bubble Tea model, update logic, view rendering.
- `internal/graphics`: iTerm2 inline image renderer plus text fallback.
- `fixtures`: replayable event streams for offline development.

State rules:

- `Update` consumes typed messages and updates one model tree.
- `View` only formats existing model state.
- Runtime side effects live in commands or bridge adapters, not view code.
- Rendering helpers receive width/height explicitly; no hidden global terminal
  reads inside layout functions.

## AutoHub Bridge Contract

For AutoHub voice cockpit work, use newline-delimited JSON over a local Unix
socket on macOS.

Event envelope:

```json
{
  "version": "autohub.voice.v1",
  "type": "audio.level",
  "seq": 1,
  "ts": "2026-05-09T00:00:00.000Z",
  "session_id": "conv-...",
  "runtime_id": "autohub-voice",
  "payload": {}
}
```

Command envelope:

```json
{
  "version": "autohub.voice.v1",
  "type": "command",
  "id": "cmd-1",
  "command": "interrupt",
  "payload": {}
}
```

Required event types for voice cockpit v1:

- `runtime.ready`, `runtime.status`, `runtime.exit`
- `voice.state`, `audio.level`, `vad.state`
- `transcript.partial`, `transcript.final`
- `assistant.delta`, `assistant.final`
- `latency.snapshot`
- `tool.start`, `tool.complete`
- `memory.retrieval`
- `diagnostic.entry`
- `agent.event`, `task.event`

Required commands:

- `interrupt`
- `sleep`
- `wake`
- `toggle_output_route`
- `toggle_interrupt_mode`
- `start_owner_enrollment`
- `quit`

## Testing Workflow

Follow test-first implementation.

1. Write protocol tests before protocol code:
   - decode valid JSONL envelopes;
   - reject malformed lines without crashing replay;
   - preserve command ids through ack/error.
2. Write model tests before UI behavior:
   - apply each required event type;
   - cap waveform, timeline, memory, and diagnostics history;
   - coalesce `audio.level` updates to the intended render cadence.
3. Write view tests before layout changes:
   - narrow, standard, and wide terminal sizes;
   - active mic, active speech, tool call, memory retrieval, diagnostic error,
     and disconnect states;
   - no empty panels that consume permanent screen space.
4. Use Bubble Tea testing support:
   - prefer model/update tests for most behavior;
   - use `github.com/charmbracelet/x/exp/teatest/v2` for rendered model output;
   - use a PTY/headless terminal harness only for end-to-end keyboard and ANSI
     behavior.
5. Add fixture replay:
   - `autohub-tui replay fixtures/<name>.jsonl`;
   - fixtures should work without microphone, model, STT, TTS, or AutoHub.
6. Add visual review artifacts for UI changes:
   - use scripted terminal capture, preferably Charm VHS, for repeatable PNG
     screenshots and GIFs;
   - cover standard, narrow, help, diagnostics, active voice, and disconnect
     states;
   - inspect generated artifacts before claiming visual work is complete;
   - attach or reference the relevant screenshot when reporting UI changes.

Testing ladder for cockpit work:

1. Plain model/protocol tests for state and schema.
2. `teatest` or PTY/grid tests for key interactions and rendered smoke checks.
3. Static fixture replay for deterministic text output.
4. `replay --hold`, demo mode, or an equivalent interactive PTY run for human
   inspection.
5. VHS screenshots/GIFs, or native terminal screenshots as a fallback, for
   design acceptance.

## Visual Rules

- Header: current phase, voice state, DB/bridge status, and persistent latency.
- Mic strip: live RMS/VAD waveform or block meter; never show static dashes as
  the only mic signal.
- Main pane: transcript first.
- Side/activity pane: tool timeline, memory ops, diagnostics. Agent/task items
  belong here unless they are actively meaningful.
- Footer: terse keymap only.
- iTerm2 graphics may use inline image escape sequences, but text fallback is
  mandatory and should be the default in tests.

## Research Checklist

Before adding dependencies or adopting outside TUI automation tools:

1. Prefer official docs for Bubble Tea, Bubbles, Lip Gloss, teatest, and the
   target terminal graphics protocol.
2. Audit third-party TUI automation projects from source before installing.
3. Avoid remote installer shortcuts. Use package managers or source-reviewed
   builds.
4. Record why a tool is used, what it verifies, and what remains covered by
   plain model tests.
5. Prefer VHS for repeatable visual QA when available. It can script terminal
   size, waits, screenshots, GIFs, and key input; use native macOS/iTerm
   screenshots only as a local fallback.

## Bubble Tea v2 Migration Notes

The v2 stack (stable since Feb 2026) is the current default for new work and
for porting v1 cockpits. The identifiers below are verified against a real
v1→v2 port — each one is a silent break if missed.

- **Module paths moved to `charm.land`, each with a `/v2` suffix**:
  `charm.land/bubbletea/v2`, `charm.land/bubbles/v2/...`,
  `charm.land/lipgloss/v2` (+ `.../v2/compat`, `.../v2/tree`),
  `charm.land/glamour/v2`. **teatest is the exception** — it stays on GitHub
  and only gains `/v2`: `github.com/charmbracelet/x/exp/teatest/v2`. Do not
  assume it moved to `charm.land` like the others.
- **`space` key, not `" "`.** v2 delivers the space bar as the key string
  `"space"`, not a `" "` rune. A keymap binding built on `" "` silently stops
  firing (in a voice cockpit, space is often interrupt — the primary control).
  Audit every binding string and add a table-driven test that synthesizes a v2
  `KeyPressMsg` for each catalog binding.
- **`View() string` → `View() tea.View`.** The model's `View` now returns a
  `tea.View` struct (cursor/background/layer fields), not a string. Keep the
  pure string renderer as `ViewString()` and wrap it in a thin
  `View() tea.View` that sets alt-screen, mouse mode, and an explicitly hidden
  cursor. This isolates blast radius and keeps `ViewString()` unit-testable;
  print sites (e.g. `replay`) call `ViewString()`.
- **lipgloss v2 `Width`/`Height` are border-inclusive.** They now count border
  and padding *inside* the given size, where v1 added them outside. Layouts
  ported verbatim shrink by the border/padding width — recompute pane budgets,
  and measure rendered width with escape-aware `ansi.StringWidth`, never `len`.
- **`AdaptiveColor` moved to `charm.land/lipgloss/v2/compat`.** The v1
  top-level `lipgloss.AdaptiveColor` is gone; the drop-in is
  `compat.AdaptiveColor{Light, Dark}`. The cleaner long-term target is
  `LightDark(isDark)` driven by `tea.BackgroundColorMsg` once you have the
  terminal background signal.
- **teatest/v2 assertions: never assert on escape-sequence goldens.**
  Renderer-version churn makes raw ANSI byte goldens brittle. Assert on
  `ansi.Strip`-ed substrings / stable markers. Under `-race`, reconstruct the
  screen from the final frame rather than diffing intermediate frames, which
  can interleave nondeterministically.

## Anti-Patterns

- Scraping runtime stdout for product state.
- Letting every audio frame trigger full layout work.
- Hiding protocol decisions inside view components.
- Adding a graphics-only feature without a text fallback.
- Shipping blank AGENTS/TASKS panels as permanent layout.
- Treating a passing build as proof that a TUI is usable.
- Treating static text replay as proof that a TUI looks good.
- Asking the user to manually open every iteration instead of generating and
  inspecting repeatable visual artifacts.
- Rebuilding AutoHub voice, model, TTS, or memory logic in Go.
