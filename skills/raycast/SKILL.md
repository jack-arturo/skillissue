---
name: raycast
description: >-
  Operate Raycast on Jack's Mac via deeplinks, Script Commands, AI
  providers.yaml/Skills/Commands/Agents, PromptLab, clipboard history, or
  Superwhisper toggle. Delegate Autohub script install to raycast-autojack.
license: MIT
tags:
  - raycast
  - desktop
  - macos
  - deeplink
  - script-commands
  - ai
  - autohub
agents:
  - claude-code
  - codex
  - autojack
category: desktop
metadata:
  version: "1.0.0"
  app_bundle: com.raycast.macos
  app_path: /Applications/Raycast.app
  related_skill: raycast-autojack
capabilities:
  network: false
  filesystem: readwrite
  tools:
    - Bash
    - Python
requires-secrets: []
resources:
  - path: references/control-surfaces.md
    type: file
  - path: references/ai-config.md
    type: file
  - path: references/troubleshooting.md
    type: file
---

# raycast

Drive **Raycast** from agents without a first-party ops CLI and without
an MCP. There is **no** FlashSpace-style inventory CLI. `npx ray` is for
*extension authors* (build/lint), not day-to-day control. Do **not**
build a Raycast MCP unless a real control API appears — it would only
wrap the same deeplinks/files.

Sibling skill: **`raycast-autojack`** owns Autohub `raycast/` install,
doctor, sync, smoke. This skill owns general Raycast operation +
file-native AI config.

---

## When to use

| User intent | Do this | Details |
|-------------|---------|---------|
| "Open clipboard history / paste queue" | deeplink built-in clipboard commands | `references/control-surfaces.md` |
| "Run Raycast command X" | Copy/construct deeplink → `open` | `references/control-surfaces.md` |
| "Add/edit a Script Command" | write file under Script Directory | `references/control-surfaces.md` |
| "Point Raycast AI at AutoJack" | edit `providers.yaml` | `references/ai-config.md` |
| "Reusable AI instructions as code" | write Raycast AI **Skills** (`SKILL.md`) | `references/ai-config.md` |
| "One-shot AI prompt as a command" | AI Commands JSON → Import AI Commands | `references/ai-config.md` |
| "Change my Agent preset instructions" | draft text; Jack applies in Settings → AI → Agents | `references/ai-config.md` |
| "Install Autohub quick-reply / voice-note scripts" | **`raycast-autojack`** skill | see below |
| "Something isn't working / verify setup" | run Doctor, check the symptom table | `references/troubleshooting.md` |
| "Configure every extension pref / Agent UI field" | **cannot fully automate** — open settings, assist | — |

---

## Safety / autonomy

| Class | Ops | Policy |
|-------|-----|--------|
| 🟢 Green | Inventory manifests; `open` known-safe deeplinks; read `providers.yaml` structure (redact secrets); list Script Directories; draft AI Skills / AI Command JSON | Run freely |
| 🟡 Yellow | Edit Script Commands; edit `providers.yaml` models/base_url; write AI Skills under `~/.config/raycast/skills`; open Import/Create AI Command UI; deeplinks that change app state (mute, caffeinate, send Slack, …) | State intent; proceed if clear |
| 🔴 Red | Paste/read API keys into chat; rewrite `.rayconfig` bulk import blindly; delete Agents/commands en masse; edit encrypted SQLite under Application Support; change OAuth tokens in prefs | Always confirm; never dump secrets |

Never print `~/.config/raycast/config.json` or raw API keys from
`providers.yaml` into the conversation.

---

## Architecture (what is / isn't agent-writable)

### Supported config surfaces

| Asset | Path / mechanism | Writable? |
|-------|------------------|-----------|
| Deeplink launch | `raycast://extensions/<author>/<ext>/<cmd>` | Invoke only |
| Script Commands | e.g. `~/Documents/Raycast Scripts/` | Yes (files) |
| AI providers | `~/.config/raycast/ai/providers.yaml` | Yes (YAML) |
| AI Skills | `~/.config/raycast/skills/<name>/SKILL.md` (+ default scan dirs) | Yes |
| AI Commands | UI create/edit; **Import AI Commands** from JSON | Draft + import |
| Agents (ex-Presets) | Settings → AI → Agents; [ray.so/presets](https://ray.so/presets) | UI / share links |
| Personalization | Settings → AI → Personalization | UI |
| Extension preferences | Raycast Settings → Extensions | UI (no write API) |
| Bulk backup | Export/Import Preferences & Data (`.rayconfig`) | UI, coarse |

### Not supported (don't fake it)

- Programmatic CRUD of every extension preference
- Silent Store install + OAuth without user
- Reading live Raycast UI state from `raycast-enc.sqlite`
- Treating plist keys under `com.raycast.macos` as a stable API

---

## Autohub Raycast scripts (`raycast-autojack`)

Repo path: `autohub/raycast/` — `quick-reply.js`, `context-reply.js`,
`voice-note-raycast.js`, `summon-autojack.js`, `install.sh`, …

```bash
# from autohub repo root, via the dedicated skill helper:
autovault skill doctor raycast-autojack --repo .
autovault skill setup raycast-autojack --repo .
autovault skill sync raycast-autojack --repo .
autovault skill smoke raycast-autojack --repo .
```

Do not re-implement installers in this skill; load **`raycast-autojack`**.

---

## Anti-patterns

- Do **not** invent an MCP server that only shells `open raycast://…`.
- Do **not** use `npx ray` as an ops tool.
- Do **not** cat secrets from `config.json` / `providers.yaml` api_keys.
- Do **not** hand-edit `raycast-enc.sqlite` or treat plist keys as API.
- Do **not** confuse Raycast AI Skills with AutoVault operator skills —
  different consumers; share formats carefully.
- Do **not** claim Agents/extension prefs are fully automatable.
- Prefer **`flashspace` CLI** over FlashSpace Raycast extension for
  workspace switching when both exist.

---

## Reference files

| File | Read when |
|------|-----------|
| `references/control-surfaces.md` | Launching a Raycast command (deeplinks, known Autohub deeplinks, installed-extension inventory) or writing/editing a Script Command; also window-management alternatives. |
| `references/ai-config.md` | Configuring Raycast AI: providers.yaml, AI Skills, AI Commands, Agents (presets), Personalization, PromptLab. |
| `references/troubleshooting.md` | Running the Doctor check, or diagnosing a symptom (deeplink/script/AI Skill not working) — plus upstream Raycast doc links. |

---

## Related skills

| Skill | Role |
|-------|------|
| **raycast** (this) | General operate + file-native AI config |
| **raycast-autojack** | Autohub script install/doctor/sync/smoke |
| **flashspace** | Virtual workspaces (CLI) |
