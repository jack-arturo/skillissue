# Control surfaces: deeplinks & Script Commands

Read this when the task is: **launch/trigger a Raycast command from an
agent** (deeplinks), or **add/edit a Script Command**. For AI
providers/skills/commands/agents see `ai-config.md`. For doctor/troubleshooting
see `troubleshooting.md`.

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

## Window management / other desktop tools

| Need | Prefer |
|------|--------|
| Virtual workspaces / app assignment | **`flashspace` skill** + CLI |
| Tiling halves/maximize | Rectangle app **or** Raycast rectangle extension deeplinks |
| Caffeinate display | coffee extension deeplink |
| Capture screen | CleanShot X extension / app |
