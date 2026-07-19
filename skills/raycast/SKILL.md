---
name: raycast
description: >-
  Operate and partially configure Raycast on Jack's Mac via deeplinks,
  Script Commands, file-based AI providers/skills, and AI Command import
  packs. Use when Jack says "open in Raycast", "run the X Raycast command",
  "deeplink", "Script Command", "AI Command/Agent/Skill", "providers.yaml",
  "Import AI Commands", "PromptLab", clipboard history, Superwhisper toggle,
  or wants Autohub Raycast scripts installed (delegate install/sync to
  raycast-autojack). Prefer this over inventing osascript launchers. Not a
  full settings API — see Supported config surfaces.
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
---

# raycast

Drive **Raycast** from agents without a first-party ops CLI and without
an MCP. Control surface:

| Surface | Agent path |
|---------|------------|
| Launch any installed command | `open 'raycast://extensions/…'` deeplink |
| Script Commands | edit/run files in a Script Directory |
| AI providers / models | `~/.config/raycast/ai/providers.yaml` |
| AI Skills (prompt packs) | `SKILL.md` under watched skill folders |
| AI Commands | draft + **Import AI Commands** (JSON) |
| Autohub Raycast scripts | skill **`raycast-autojack`** |

There is **no** FlashSpace-style inventory CLI. `npx ray` is for
*extension authors* (build/lint), not day-to-day control. Do **not**
build a Raycast MCP unless a real control API appears — it would only
wrap the same deeplinks/files.

---

## When to use

| User intent | Do this |
|-------------|---------|
| "Open clipboard history / paste queue" | deeplink built-in clipboard commands |
| "Run Raycast command X" | Copy/construct deeplink → `open` |
| "Add/edit a Script Command" | write file under Script Directory |
| "Point Raycast AI at AutoJack" | edit `providers.yaml` |
| "Reusable AI instructions as code" | write Raycast AI **Skills** (`SKILL.md`) |
| "One-shot AI prompt as a command" | AI Commands JSON → Import AI Commands |
| "Install Autohub quick-reply / voice-note scripts" | **`raycast-autojack`** skill |
| "Configure every extension pref / Agent UI field" | **cannot fully automate** — open settings, assist |

Sibling skill: **`raycast-autojack`** owns Autohub `raycast/` install,
doctor, sync, smoke. This skill owns general Raycast operation +
file-native AI config.

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

## Doctor

```bash
test -d /Applications/Raycast.app && echo "app: ok" || echo "app: MISSING"
open -Ra Raycast 2>/dev/null || true

# Extension manifests (config copy used for development + many installs)
python3 - <<'PY'
import json, pathlib
root = pathlib.Path.home() / ".config/raycast/extensions"
if not root.exists():
    print("no ~/.config/raycast/extensions")
else:
    for d in sorted(root.iterdir()):
        pkg = d / "package.json"
        if not pkg.is_file():
            continue
        j = json.loads(pkg.read_text())
        author = j.get("author") or j.get("owner") or "?"
        if isinstance(author, dict):
            author = author.get("name") or author.get("handle") or "?"
        cmds = [c.get("name") for c in (j.get("commands") or [])]
        print(f"{j.get('name')}\t{author}\t{len(cmds)} cmds")
PY

echo "providers: $HOME/.config/raycast/ai/providers.yaml"
ls -la "$HOME/Documents/Raycast Scripts" 2>/dev/null || true
ls -la "$HOME/.config/raycast/skills" 2>/dev/null || echo "skills dir not created yet"
```

If deeplinks prompt every time: in Raycast, allow deeplinks for that
command (prefs key family `alwaysAllowCommandDeeplinking`). User can
also use **Copy Deeplink** (⌘K → Copy Deeplink / ⌘⇧C) from root search.

---

## Deeplinks (primary control plane)

Format:

```text
raycast://extensions/<author-or-owner>/<extension-name>/<command-name>
```

Query params (optional):

| Param | Purpose |
|-------|---------|
| `launchType=background` | Run without focusing Raycast when supported |
| `launchType=userInitiated` | Default foreground |
| `arguments` | URL-encoded JSON object of command args |
| `fallbackText` | Prefill search / first text field |
| `context` | URL-encoded LaunchContext JSON |

Launch:

```bash
open 'raycast://extensions/raycast/clipboard-history/clipboard-history'
open 'raycast://extensions/raycast/clipboard-history/paste-queue'
open 'raycast://extensions/nchudleigh/superwhisper/toggle-record'
# background when the command supports it:
open 'raycast://extensions/<author>/<ext>/<cmd>?launchType=background'
```

**Built-in** extensions use author `raycast` and slugified names
(`calendar`, `clipboard-history`, …).

**Discover a deeplink:** Raycast root search → command → ⌘K →
**Copy Deeplink**. Prefer that over guessing.

### Known Autohub / Jack deeplinks

```bash
# Clipboard (used by tools/clipboard-tool.js)
open 'raycast://extensions/raycast/clipboard-history/clipboard-history'
open 'raycast://extensions/raycast/clipboard-history/paste-queue'

# Superwhisper (used by raycast/voice-note-raycast.js)
open 'raycast://extensions/nchudleigh/superwhisper/toggle-record'
```

### Installed extensions snapshot (orientation only — re-inventory)

Config-dir inventory 2026-07-19 (`~/.config/raycast/extensions`).
Author/name for deeplink construction:

| Extension | Author | Useful commands (sample) |
|-----------|--------|--------------------------|
| flashspace | krmbzds | activate-workspace, list-workspaces, … |
| promptlab | HelloImSteven | create-command, search-commands, import-commands, chat |
| spotify-player | mattisssa | togglePlayPause, nowPlaying, search |
| github | thomaslombart | my-pull-requests, my-issues, create-issue |
| slack | mommertf | search, send-message, unread-messages |
| google-calendar | thomas | create-event, list-events |
| google-chrome | Codely | new-tab, search-tab, search-history |
| homeassistant | tonka3000 | index, lights, covers, … |
| todoist | thomaslombart | home, create-task, quick-add-task |
| cursor-recent-projects | degouville | index, open-with-cursor |
| gmail | tonka3000 | mails, unread, drafts |
| safari | loris | search-bookmarks, cloud-tabs |
| coffee | mooxl | caffeinate, decaffeinate, caffeinateToggle |
| mute-microphone | Quentin23Soleil | toggle-mute, mute-menu-bar |
| cleanshotx | Aayush9029 | capture-area, capture-fullscreen |
| rectangle | crickford | left-half, right-half, maximize |
| iterm | ron-myers | new-iterm-window, open-iterm-here |
| translate | gebeto | translate, quick-translate |
| timers | ThatNerd | start*MinuteTimer |
| elevenlabs-tts | lachie_james | speak-selected |
| voiceink | metrovoc | search-transcriptions |
| ccusage | nyatinte | ccusage, claude-code-stats |
| gif-search | josephschmitt | search |
| lorem-ipsum | AntonNiklasson | paragraphs, sentences |
| tokenizer | ashleymavericks | tokenizeSelected |
| ray-so | garrettt | create-a-snippet |
| mac-app-store-search | say4n | index |
| clean-keyboard | ike-gg | clean-keyboard |

Example:

```bash
open 'raycast://extensions/mattisssa/spotify-player/togglePlayPause'
open 'raycast://extensions/mooxl/coffee/caffeinateToggle'
open 'raycast://extensions/HelloImSteven/promptlab/search-commands'
```

Authors/names are case-sensitive as stored in the manifest. If a
deeplink 404s, re-read `package.json` `author`/`name`/`commands[].name`.

**FlashSpace note:** workspace control prefers the **`flashspace` CLI
skill** (`flashspace workspace --name Code`). The Raycast FlashSpace
extension is optional UI sugar.

---

## Script Commands

Raycast indexes scripts in configured directories
(Settings → Script Commands → Add Script Directory).

**Jack's directory:** `~/Documents/Raycast Scripts/`

Current scripts (snapshot): `exempt-app-from-yabai.sh`,
`fix-claude-desktop.sh`, `resize-claude-30.sh`,
`toggle-yabai-window.sh`, `voice-to-todoist.js` → voice-to-todoist repo.

### Metadata header (required)

```bash
#!/bin/bash

# @raycast.schemaVersion 1
# @raycast.title My Command
# @raycast.mode silent
# @raycast.packageName Personal
# @raycast.icon ⚡
# @raycast.description What it does

# optional argument:
# @raycast.argument1 { "type": "text", "placeholder": "query" }

echo "hello"
```

Modes: `silent` | `compact` | `fullOutput` | `inline` (see
[script-commands repo](https://github.com/raycast/script-commands)).

**Agent tip:** for reliability, run the script file directly with its
shebang interpreter when you do not need Raycast UI/output modes.
Use a deeplink only when the command must run *inside* Raycast.

After adding files: **Reload Script Directories** in Raycast if they
do not appear (often auto-picks up metadata edits).

---

## AI: providers, skills, commands, agents

### Providers (`providers.yaml`) — agent-writable

Path: `~/.config/raycast/ai/providers.yaml`
Template: `~/.config/raycast/ai/providers.template.yaml`

Jack already points an **AutoJack (Local)** provider at
`http://localhost:8767` with Claude/local model ids. Edit model list /
`base_url` with care; **never echo api_keys**.

After edits, relaunch Raycast or re-open AI settings if models do not
refresh.

### AI Skills — preferred programmable prompts

Raycast scans (defaults):

- `~/.claude/skills`
- `~/.config/agents/skills`
- `~/.config/raycast/skills`
- `~/.agents/skills`

Layout:

```text
~/.config/raycast/skills/<name>/SKILL.md
```

`SKILL.md` needs YAML frontmatter with `name` + `description` (Agent
Skills style). Folder name must match `name`. Raycast caches ~60s.

```bash
mkdir -p ~/.config/raycast/skills/my-skill
# write SKILL.md with name: my-skill and a when-to-use description
```

Skills apply in **AI Chat / Quick AI** (tool-capable models), not in
AI Commands. Mention with `@` or rely on auto-discovery.

**AutoVault overlap:** many `~/.claude/skills/*` are already visible to
Raycast if that folder is enabled. Prefer writing Jack-specific Raycast
AI packs under `~/.config/raycast/skills` so they are not confused with
Claude Code operator skills.

### AI Commands — one-shot prompts

- Create: Root Search → **Create AI Command**
- Manage: **Search AI Commands** (edit ⌘E, duplicate ⌘D, share)
- **Import AI Commands** accepts a JSON file of commands

Agent workflow for bulk prompt packs:

1. Author a JSON pack (export one command from Raycast once to learn shape, or use Import docs).
2. Save under a project path (no secrets).
3. Open **Import AI Commands** (deeplink if known, else tell Jack to run it) and select the file.

Placeholders in prompts: `{selection}`, `{argument name="…"}`,
clipboard/date placeholders — see Dynamic Placeholders manual.
`@extension` mentions pull AI Extensions into a command.

### Agents (ex-Presets) — mostly UI

Settings → AI → Agents: name, instructions (system prompt), model,
scoped AI Extensions. Community: [ray.so/presets](https://ray.so/presets).

Agents do **not** have a documented local file CRUD API. Skill can
draft instruction text for Jack to paste, open Agents settings via
UI navigation, or install from a share link — not silent rewrite.

### Personalization — UI

Profile + Memory under Settings → AI → Personalization. Do not scrape
encrypted DB.

### PromptLab (installed)

Extension `promptlab` / author `HelloImSteven` — community prompt lab
with create/search/import/chat commands. Useful when Jack wants
PromptLab-native flows; still secondary to first-party AI Skills for
file-based agent control.

```bash
open 'raycast://extensions/HelloImSteven/promptlab/search-commands'
open 'raycast://extensions/HelloImSteven/promptlab/import-commands'
```

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

## Window management / other desktop tools

| Need | Prefer |
|------|--------|
| Virtual workspaces / app assignment | **`flashspace` skill** + CLI |
| Tiling halves/maximize | Rectangle app **or** Raycast rectangle extension deeplinks |
| Caffeinate display | coffee extension deeplink |
| Capture screen | CleanShot X extension / app |

---

## AutoJack / agent quick paths

1. **"Open clipboard history"**
   → `open 'raycast://extensions/raycast/clipboard-history/clipboard-history'`
2. **"Toggle Superwhisper"**
   → `open 'raycast://extensions/nchudleigh/superwhisper/toggle-record'`
3. **"Pause Spotify"**
   → `open 'raycast://extensions/mattisssa/spotify-player/togglePlayPause'`
4. **"Add an AI skill for X"**
   → write `~/.config/raycast/skills/<slug>/SKILL.md`
5. **"Point AI at local AutoJack"**
   → ensure `providers.yaml` AutoJack provider + hub on `:8767`
6. **"Install Autohub Raycast scripts"**
   → `raycast-autojack` setup
7. **"Change my Agent preset instructions"**
   → draft text; Jack applies in Settings → AI → Agents (or share link)

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

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Deeplink does nothing | App not running; `open -a Raycast`; check extension installed/enabled |
| Confirm prompt every time | Allow deeplink for that command in Raycast |
| Command name wrong | Re-read extension `package.json`; Copy Deeplink from UI |
| Script Command missing | Confirm Script Directory; Reload Script Directories; check `@raycast.schemaVersion` |
| AI models missing | Check `providers.yaml`; hub up for AutoJack; restart Raycast |
| AI Skill not loading | Folder/name/`SKILL.md` rules; tool-capable model; wait ~60s; try `@` mention |
| Accessibility / paste fails | Grant Accessibility to **Raycast** (not Terminal) |

---

## Reference links

- Deeplinks: https://developers.raycast.com/information/lifecycle/deeplinks
- Script Commands: https://manual.raycast.com/script-commands
  https://github.com/raycast/script-commands
- AI Commands / Agents / Skills: https://manual.raycast.com/ai
- AI Skills folders: https://manual.raycast.com/ai/skills
- Preset explorer: https://ray.so/presets

---

## Related skills

| Skill | Role |
|-------|------|
| **raycast** (this) | General operate + file-native AI config |
| **raycast-autojack** | Autohub script install/doctor/sync/smoke |
| **flashspace** | Virtual workspaces (CLI) |
