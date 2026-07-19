---
name: flashspace
description: >-
  Operate FlashSpace virtual workspaces on Jack's Mac via the installed
  `flashspace` CLI (v1.0.0 from FlashSpace.app). Switch profiles and
  workspaces, assign/unassign apps, manage floating apps, focus windows,
  inventory displays, and clean unassigned apps. Use when Jack says
  "switch workspace/space", "go to Code/Web/Chat/Terminal", "FlashSpace",
  "assign this app", "float/unfloat", "list workspaces", "hide unassigned",
  or wants a dual-display workspace change. Prefer this over reinventing
  Mission Control / yabai / AeroSpace scripts.
license: MIT
tags:
  - flashspace
  - workspace
  - desktop
  - macos
  - window-management
  - multi-display
  - autohub
agents:
  - claude-code
  - codex
  - autojack
category: desktop
metadata:
  version: "1.0.0"
  cli: flashspace
  app_bundle: pl.wojciechkulik.FlashSpace
  install: brew install --cask flashspace
  cli_path: /opt/homebrew/bin/flashspace
capabilities:
  network: false
  filesystem: readonly
  tools:
    - Bash
requires-secrets: []
---

# flashspace

Drive **FlashSpace** (virtual workspace manager for macOS) through its
first-party CLI. The binary ships inside the app and is linked on PATH:

```text
/opt/homebrew/bin/flashspace
  → /Applications/FlashSpace.app/Contents/Resources/flashspace
```

Install / upgrade: `brew install --cask flashspace` (macOS ≥ 14).
CLI version: `flashspace --version`. App help: `flashspace --help` and
`flashspace help <subcommand>`.

This skill is **operator-only** — it does not reconfigure the app's
GUI prefs, Accessibility permissions, or launch-at-login. If the CLI
returns nothing useful, open the app once (`flashspace open`) and
confirm Accessibility is granted.

---

## When to use

| User intent | Primary verbs |
|-------------|---------------|
| "Switch to Code / Web / Chat / Terminal" | `workspace --name …` |
| "What's on right now?" | `get-profile`, `get-workspace`, `get-app`, `list-*` |
| "Put Cursor on Code" / "assign this app" | `assign-app` |
| "Float Spotify" / "stop floating Finder" | `floating-apps float\|unfloat\|toggle` |
| "Clean up junk windows" | `workspace --name X --clean` or `hide-unassigned-apps` |
| "Next / prev space" | `workspace --next\|--prev` |
| "Focus the left window" | `focus --direction left` |
| "New workspace for …" | `create-workspace` (confirm first) |

Do **not** use this skill for tiling geometry (that's Rectangle Pro /
Hammerspoon), browser tabs, or Mission Control Spaces. FlashSpace
workspaces are app-assignment spaces, not macOS Spaces.

---

## Safety / autonomy

| Class | Ops | Policy |
|-------|-----|--------|
| 🟢 Green | `list-*`, `get-*`, `workspace` activate, `profile` activate, `focus`, `open`, `open-space-control`, `floating-apps` toggle on active app | Run freely |
| 🟡 Yellow | `assign-app`, `unassign-app`, `assign-visible-apps`, `floating-apps float\|unfloat` by name, `update-workspace`, `create-workspace`, `create-profile`, `hide-unassigned-apps`, `workspace --clean` | Say what you'll do; proceed if intent is clear |
| 🔴 Red | `delete-workspace`, `delete-profile`, bulk reassignment across many workspaces, recreating Jack's whole layout | Always confirm first |

Destructive deletes and "rebuild my layout" are red even when the user
sounds casual. Prefer `list-*` first so names match exactly (spaces
and casing matter: `Project Mgmt`, not `Project Management`).

---

## Orientation (always re-list; snapshot is stale-tolerant)

Jack's dual-display layout under profile **Default** (snapshot
2026-07-19 — re-run the list commands; do not treat this as SSOT):

**Displays**

| Display | Role |
|---------|------|
| Studio Display | Primary external — Code / Web / AI / Build |
| Built-in Retina Display | Laptop — Chat / Terminal / Notes / Music / Admin / Private |

**Workspaces → display (typical apps)**

| Workspace | Display | Typical apps |
|-----------|---------|--------------|
| Music | Built-in | Spotify, WiiM Home |
| Notes | Built-in | Evernote, Notes, Todoist, Calendar |
| Chat | Built-in | Slack, Messages, Telegram, Signal, Zoom |
| Project Mgmt | Built-in | GitHub Desktop |
| Terminal | Built-in | iTerm2, Terminal |
| Web | Studio Display | Chrome, Safari, Home Assistant |
| Code | Studio Display | Cursor, VS Code, GitHub Desktop, Tower |
| AI | Studio Display | Claude, ChatGPT, Codex |
| Build | Studio Display | Unity Hub, Xcode, Local, Docker, Meta XR Simulator |
| Admin | Built-in | TablePlus, Transmit |
| Private | Built-in | Yandex, ExpressVPN |

**Floating apps** (visible on every workspace): Finder, System Settings,
Raycast, FlashSpace, Hammerspoon, Rectangle Pro, Spotify.

Profiles currently present: `Alt`, `Default`. Active is usually
`Default`.

When uncertain, prefer:

```bash
flashspace get-profile
flashspace get-workspace
flashspace get-display
flashspace get-app --with-windows-count
flashspace list-workspaces --with-display
flashspace list-apps "<Workspace>" --with-bundle-id
flashspace list-floating-apps --with-bundle-id
flashspace list-running-apps --with-bundle-id
flashspace list-displays
```

---

## Doctor (first response when CLI looks broken)

```bash
command -v flashspace || echo "MISSING: brew install --cask flashspace"
flashspace --version
flashspace get-profile
flashspace list-workspaces --with-display
# if silent / errors:
flashspace open   # ensure app is running + Accessibility granted
```

Expected healthy output: a profile name, a workspace list with
display names, no permission errors.

---

## Core recipes

### Switch workspace (most common)

```bash
flashspace workspace --name Code
flashspace workspace --name Web
flashspace workspace --name Chat
flashspace workspace --name Terminal
flashspace workspace --name "Project Mgmt"   # quote multi-word names
```

Also:

```bash
flashspace workspace --number 1            # 1-indexed
flashspace workspace --next
flashspace workspace --prev
flashspace workspace --recent
flashspace workspace --next --skip-empty --loop
flashspace workspace --name Code --clean   # also hide unassigned apps
```

### Activate profile

```bash
flashspace profile Default
flashspace profile Alt
flashspace profile --next
flashspace profile --prev
```

### Assign / unassign apps

```bash
# active app → active workspace
flashspace assign-app --show-notification

# named app → named workspace
flashspace assign-app --name Cursor --workspace Code --show-notification
flashspace assign-app --name "Google Chrome" --workspace Web

# by bundle id when names collide
flashspace assign-app --name com.todesktop.230313mzl4w4u92 --workspace Code

# drop app from every workspace
flashspace unassign-app --name Spotify --show-notification

# bulk: every currently visible app → target workspace
flashspace assign-visible-apps --workspace Code --show-notification
```

`--activate true|false` on `assign-app` overrides the app setting for
whether assigning also jumps to that workspace.

### Floating apps

```bash
flashspace floating-apps float --name Spotify
flashspace floating-apps unfloat --name Finder
flashspace floating-apps toggle                 # active app
flashspace list-floating-apps --with-bundle-id
```

### Focus

```bash
flashspace focus --direction left|right|up|down
flashspace focus --next-app
flashspace focus --prev-app
flashspace focus --next-window
flashspace focus --prev-window
```

### Create / update / delete (confirm on delete)

```bash
flashspace create-workspace "Review" \
  --display "Studio Display" \
  --icon hammer \
  --activate

flashspace update-workspace --workspace Review --display "Studio Display"
flashspace update-workspace --active-workspace --open-apps true
flashspace update-workspace --active-workspace --active-display

# RED — confirm first
flashspace delete-workspace Review

flashspace create-profile Focus --copy --activate
flashspace delete-profile Focus   # RED
```

`--icon` must be a valid **SF Symbol** name.

### Hide unassigned / open UI

```bash
flashspace hide-unassigned-apps
flashspace open
flashspace open-space-control
```

---

## AutoJack / agent quick paths

When Jack says:

1. **"Go to Code / Web / Chat / Terminal / AI / Build"**
   → `flashspace workspace --name <Name>` (quote multi-word names).
2. **"What's my layout?" / "which space am I on?"**
   → `get-profile` + `get-workspace` + `list-workspaces --with-display`.
3. **"Put this app on Code"** (active app implied)
   → `flashspace assign-app --workspace Code --show-notification`.
4. **"Float this"**
   → `flashspace floating-apps toggle --show-notification`.
5. **"Clean this space"**
   → `flashspace workspace --name "$(flashspace get-workspace)" --clean`
     or `flashspace hide-unassigned-apps`.
6. **"Next space"**
   → `flashspace workspace --next --skip-empty`.

Prefer exact workspace names from `list-workspaces`. Do not invent
aliases (`coding` ≠ `Code`).

---

## Naming & quoting rules

- Workspace names are **case-sensitive** and may contain spaces
  (`Project Mgmt`). Always quote multi-word names.
- App identity accepts **display name or bundle id**. Prefer bundle id
  when two apps share a label (e.g. ChatGPT vs Codex both branded
  ChatGPT-ish).
- Display names come from `list-displays` (`Studio Display`,
  `Built-in Retina Display`) — pass them exactly to
  `create-workspace --display` / `update-workspace --display`.
- Profiles are independent workspace sets. Mutations apply to the
  **active** profile unless a command takes `--profile`.

---

## Anti-patterns

- Do **not** shell out to `osascript` / `yabai` / raw Accessibility to
  fake workspace switching when FlashSpace is installed.
- Do **not** delete workspaces or profiles to "tidy up" without
  explicit confirmation.
- Do **not** `assign-visible-apps` as a silent default — it rebinds
  every on-screen app.
- Do **not** hard-code the 2026-07-19 inventory as truth; re-list when
  the answer depends on current state.
- Do **not** treat FlashSpace workspaces as macOS Mission Control
  Spaces — different system; mixing the two confuses the user.
- Do **not** store secrets or Accessibility tokens; there are none.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `command not found: flashspace` | `brew install --cask flashspace`; ensure `/opt/homebrew/bin` on PATH |
| CLI runs but no effect | App not running or missing Accessibility — `flashspace open`, then System Settings → Privacy → Accessibility |
| Wrong display | `list-displays` + `update-workspace --workspace X --display "…"` or `--active-display` |
| App still shows on every space | It's floating — `floating-apps unfloat --name …`, or never assigned (assign it) |
| Name not found | Re-run `list-workspaces` / `list-apps`; check profile with `get-profile` |
| Multi-word name fails | Quote it: `--name "Project Mgmt"` |
| Want SF Symbol list for icons | Use Apple's SF Symbols app; FlashSpace rejects unknown names |

---

## Subcommand map (quick reference)

```text
PROFILES   create-profile | delete-profile | profile | list-profiles | get-profile
WORKSPACES create-workspace | delete-workspace | update-workspace | workspace
           list-workspaces | get-workspace
APPS       assign-visible-apps | assign-app | unassign-app | hide-unassigned-apps
           list-apps | list-running-apps | get-app
FLOATING   floating-apps | list-floating-apps
FOCUS      focus
DISPLAYS   list-displays | get-display
UI         open | open-space-control
```

Full flags: `flashspace help <subcommand>`.
