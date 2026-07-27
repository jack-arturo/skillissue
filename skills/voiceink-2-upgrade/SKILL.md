---
name: voiceink-2-upgrade
description: >-
  Migrate and harden a VoiceInk 1.x setup onto VoiceInk 2.0: Modes, Parakeet V3,
  enhancement providers, custom OpenAI-compatible assistants, shared hub Parakeet
  STT via /v1/audio/transcriptions, dictionary/word replacements (emoji, ellipsis,
  literal paths), bilingual auto language, and a settings-backup import pack. Use
  when someone upgraded to VoiceInk 2, lost Modes/Power Modes, hits "Download
  required for English (United States)", sees "Enhancement failed: Failed to
  decode response", wants emoji-from-speech, German/EN mixed dictation, a Custom
  assistant endpoint, or one warm Parakeet for VoiceInk + a local hub.
license: MIT
tags:
  - voiceink
  - macos
  - dictation
  - transcription
  - parakeet
  - migration
  - productivity
agents: [claude-code, codex, autojack, cursor]
category: desktop
metadata:
  version: "1.1.0"
  voiceink_min: "2.0"
  docs:
    modes: https://tryvoiceink.com/docs/modes
    models: https://tryvoiceink.com/docs/recommended-models
    custom: https://tryvoiceink.com/docs/custom-models
    local: https://tryvoiceink.com/docs/local-models
capabilities:
  network: true
  filesystem: readwrite
  tools:
    - Bash
    - Read
    - Edit
    - Write
    - Python
requires-secrets: []
resources:
  - path: references/upgrade-checklist.md
    type: file
  - path: references/enhancement-prompt.md
    type: file
  - path: references/starter-replacements.json
    type: file
  - path: references/mode-map.md
    type: file
  - path: references/social-copy.md
    type: file
  - path: scripts/validate_backup.py
    type: file
  - path: story.md
    type: file
---

# VoiceInk 2.0 Upgrade

Turn a messy VoiceInk 2.0 install into a Mode-based dictation setup that stays
fast, keeps your dictionary, and doesn't fall into Apple Speech / empty-prompt
traps.

This skill is the operator runbook. It is **not** a VoiceInk support channel and
it does **not** ship anyone else's API keys, license, or full personal
dictionary dump.

## When to use

- User just updated to VoiceInk 2.0 and Modes / Power Modes feel broken or empty
- `Transcription Failed: Download required for English (United States)` (Apple Speech)
- `Enhancement failed: Failed to decode response` with `prompt=<none>` in History
- They want Parakeet V3 + a fast cleanup model + an optional Custom assistant endpoint
- They want spoken emoji → characters, `...` from "dot dot dot", literal `mcp-client.js` paths
- They want mixed EN/DE (or another language) without fighting English-only models
- They already run a local OpenAI-compatible Parakeet/MLX server and want VoiceInk
  to share it instead of loading a second FluidAudio copy

## Hard lessons from the 2.0 cutover

1. **Apple Speech ≠ Parakeet.** "Download required for English (United States)" is
   Apple Speech language assets (macOS 26+). If Parakeet V2/V3 is already on disk
   under `~/Library/Application Support/FluidAudio/Models/`, switch Modes off
   Apple Speech instead of chasing the download.
2. **v2 onboarding can wipe Mode storage.** Upgrading may clear
   `powerModeConfigurationsV2` / `modeConfigurationsV2`. Export Settings *before*
   opening 2.0 when possible; recover from a pre-upgrade plist if needed
   ([upstream issue discussion](https://github.com/Beingpax/VoiceInk/issues/827)).
3. **Enhancement with no prompt always fails.** History rows with
   `prompt=<none>` + enhancement enabled produce decode failures. Every Mode
   with AI Enhancement **must** set a prompt UUID.
4. **Emoji in Brief needs word replacements.** Modes with enhancement off never
   run the cleanup prompt — put `exhaling emoji` → `😮‍💨` (etc.) in Dictionary →
   Word Replacements so they work everywhere.
5. **Custom assistant endpoints are not in the settings backup schema.**
   `customAIProviders` / `customProviderBaseURL` live in prefs + Keychain. Modes
   can point at `Custom` + a model name, but the provider itself must be created
   under AI Models → Custom (or written to prefs carefully while VoiceInk is quit).
6. **Dictionary lives in SwiftData `dictionary.store`.** Path:
   `~/Library/Application Support/com.prakashjoshipax.VoiceInk/dictionary.store`.
   Other tools (e.g. a local Parakeet STT lexicon) can read it read-only — do not
   assume FluidAudio CoreML weights are shared with MLX/parakeet-mlx installs.
7. **Custom transcription needs the full OpenAI path.** Bare `localhost:8178` 404s.
   VoiceInk posts multipart to `/v1/audio/transcriptions`. Empty Test probes and
   headerless "wav" clips need a server that normalizes (or treats empty as OK).

## Recommended stack (2026-07 VoiceInk docs + field notes)

| Layer | Recommendation |
|---|---|
| Transcription | **Hub Parakeet** Custom model → local OpenAI `/v1/audio/transcriptions` (shared MLX), **or** local FluidAudio **Parakeet V3** if you have no hub |
| Cleanup enhancement | **Cerebras `gpt-oss-120b`** (or Groq `openai/gpt-oss-120b` / Gemini `gemini-3.5-flash`) |
| Assistant / compose Mode | **Custom** OpenAI-compatible chat endpoint (your hub/agent), model name your server expects |
| Keep enhancement &lt; ~2s | If cleanup feels slow, switch provider — don't reach for a flagship chat model |

## Workflow

Follow [references/upgrade-checklist.md](references/upgrade-checklist.md) in order.

### 1. Snapshot

```bash
# VoiceInk → Settings → Backup → Export Settings
# Also copy prefs if Modes vanished:
cp ~/Library/Preferences/com.prakashjoshipax.VoiceInk.plist \
  ~/Desktop/VoiceInk-prefs-pre-tune-$(date +%Y%m%d-%H%M%S).plist
```

### 2. Kill Apple Speech dead-ends

In Modes (and unfinished onboarding), set transcription to **Parakeet V3**, not
Apple Speech. Confirm models exist:

```bash
ls ~/Library/Application\ Support/FluidAudio/Models/
# expect parakeet-tdt-0.6b-v3/ (and maybe v2)
```

### 3. Build Modes

Use [references/mode-map.md](references/mode-map.md) as the default architecture:

| Mode | Enhance? | Output | Typical triggers |
|---|---|---|---|
| Default | Yes — Cerebras + cleanup prompt | Paste | isDefault; AI apps; Slack |
| Brief | No | Paste | WhatsApp / Messages; word `brief` |
| Assistant | Yes — Custom endpoint | Respond | word triggers (`hey aj`, etc.) |
| Submit | No | Paste + Return | Raycast |
| Email | Yes — cleanup | Paste | Mail / Gmail |
| German (optional) | Yes — cleanup | Paste | word `auf deutsch`; language `de` |

### 4. Wire the cleanup prompt

Paste / adapt [references/enhancement-prompt.md](references/enhancement-prompt.md)
into a custom prompt. Point **Default** (and Email) at that prompt's UUID.
Never leave `selectedPrompt` empty on an enhancing Mode.

### 5. Dictionary: replacements first, vocab second

Open [references/starter-replacements.json](references/starter-replacements.json).
Merge **only** the `.replacements` object into Dictionary → Word Replacements
(or into an exported settings JSON's `wordReplacements` map). Do **not** paste
the whole file — `_comment` and `vocabulary_starters` are not replacement pairs.

Then add `.vocabulary_starters` (plus personal proper nouns) to Vocabulary.

Replacements are deterministic and apply even when enhancement is off.
Vocabulary mainly helps AI enhancement spelling.

### 6. Custom assistant (optional)

1. AI Models → Custom → add OpenAI-compatible **chat completions** URL + model
2. Verify (localhost hubs often accept any Bearer token)
3. Assistant Mode: provider `Custom`, that model name, output **Respond**
4. Re-export Settings after verifying — Modes will round-trip; the Custom
   provider entry itself may still need to be recreated on a fresh Mac

### 6b. Hub Parakeet — shared STT (optional, RAM win)

If you already run a local Parakeet/MLX server (e.g. AutoHub on `:8178`), point
VoiceInk at it instead of loading a second FluidAudio CoreML copy.

1. Ensure the server is up and speaks OpenAI transcriptions:

```bash
curl -sS http://127.0.0.1:8178/health   # ready: true
# VoiceInk needs the FULL path (bare :8178 → HTTP 404):
#   http://127.0.0.1:8178/v1/audio/transcriptions
```

2. AI Models → Custom → **Add Custom Transcription Model**:

| Field | Value |
|---|---|
| Display Name | Hub Parakeet |
| API Endpoint | `http://127.0.0.1:8178/v1/audio/transcriptions` |
| API Key | any dummy (`sk-local`) |
| Model Name | `parakeet` (or whatever `/v1/models` lists) |
| Multilingual | on for v3 |

3. Modes → Transcription → Model → **Hub Parakeet** (language `auto`).
4. Unload/remove local FluidAudio Parakeet from VoiceInk’s Local catalog so Modes
   do not keep a second runtime warm.
5. Keep the server warm independently of the VoiceInk UI (LaunchAgent / hub
   voice `ensureParakeet`). Dictation before the process is up → connection errors.

Caveat: Custom cloud transcription is whole-utterance HTTP, not FluidAudio’s
on-device realtime partials. Trade partials for one shared ~1 GB MLX process.

### 7. Validate a backup JSON before import

Find the bundled validator with `autovault skill which voiceink-2-upgrade validate_backup.py`
or use the installed resource path directly (it must resolve relative to this
skill's own directory, not the current project's working directory):

```bash
python3 ~/.autovault/skills/voiceink-2-upgrade/scripts/validate_backup.py \
  /path/to/VoiceInk_Settings_Import.json
```

Then VoiceInk → Settings → Backup → Import Settings (Modes + Prompts + Dictionary
at minimum).

### 8. Prove it in History

- Dictate with Default → History shows prompt name (not blank) and a real enhance
- Brief: say `thumbs up emoji` → `👍` via replacements alone
- Assistant word trigger → Respond panel, not paste
- If Apple Speech errors return, a Mode still points at Apple Speech

## Safety

| Class | Action |
|---|---|
| 🟢 | Read History / prefs / FluidAudio model dirs; validate backup JSON; draft Mode maps |
| 🟡 | Edit exported settings JSON; merge replacements; write prefs while VoiceInk is **quit** |
| 🔴 | Delete Modes wholesale; overwrite `dictionary.store` without backup; commit/export someone else's full personal dictionary publicly |

Never publish a settings backup that contains private chat transcripts, API keys,
or a highly personal replacement map without scrubbing.

## Anti-patterns

- Leaving Default on Apple Speech "because onboarding suggested it"
- Enabling AI Enhancement with no prompt selected
- Putting emoji conversion only in the prompt, then using Brief for chat apps
- Expecting settings import to recreate Custom provider Keychain entries
- Translating German dictation into English in the cleanup prompt
- "Helpful" enhancement that rewrites `mcp-client.js` into prose
- Pointing Custom Transcription at `http://localhost:8178` without `/v1/audio/transcriptions`
- Running Hub Parakeet **and** FluidAudio Parakeet loaded at once “just in case”

## References

- [upgrade-checklist.md](references/upgrade-checklist.md)
- [mode-map.md](references/mode-map.md)
- [enhancement-prompt.md](references/enhancement-prompt.md)
- [starter-replacements.json](references/starter-replacements.json)
- [social-copy.md](references/social-copy.md) — launch posts for skillissue / socials
- VoiceInk docs: Modes, Recommended Models, Custom Models, Local Models (see frontmatter `metadata.docs`)
