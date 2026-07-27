# VoiceInk 2.0 upgrade checklist

Copy this into the session notes and tick as you go.

## Before opening 2.0 (if you still can)

- [ ] VoiceInk → Settings → Backup → **Export Settings**
- [ ] Copy `~/Library/Preferences/com.prakashjoshipax.VoiceInk.plist`
- [ ] Note current transcription model + whether AI enhancement was on

## After install / first launch

- [ ] Finish or **dismiss** v2 onboarding (stuck `onboardingStage=model` is a footgun)
- [ ] AI Models → Local → download **Parakeet V3** *or* plan Hub Parakeet (below)
- [ ] If using local FluidAudio: enable realtime / streaming for V3; confirm `~/Library/Application Support/FluidAudio/Models/parakeet-tdt-0.6b-v3` exists
- [ ] Do **not** leave active Modes on Apple Speech unless English (US) asset is downloaded

## Modes

- [ ] At least one Mode with `isDefault: true`, Paste output, Parakeet (local or Hub), language `auto`
- [ ] Default Mode has AI Enhancement **on** + a real cleanup prompt selected
- [ ] Brief Mode: enhancement **off**, messaging apps, language `auto`
- [ ] Optional Assistant Mode: Custom provider, Respond output, word triggers
- [ ] Optional Submit Mode: Paste + Auto Send Return (Raycast / chat UIs)
- [ ] Optional Email Mode: Mail/Gmail triggers, cleanup prompt, clipboard context on
- [ ] No enhancing Mode with empty `selectedPrompt`

## Hub Parakeet (optional shared STT)

- [ ] `curl -sS http://127.0.0.1:8178/health` → `ready: true` (LaunchAgent or hub voice)
- [ ] Custom Transcription endpoint is the **full** URL `http://127.0.0.1:8178/v1/audio/transcriptions`
- [ ] Model name `parakeet`, multilingual on; Test succeeds
- [ ] Modes point at Hub Parakeet; local FluidAudio Parakeet unloaded to avoid double RAM
- [ ] Note: whole-utterance HTTP ≠ FluidAudio realtime partials

## Enhancement

- [ ] Cleanup provider is fast (Cerebras/Groq/Gemini flash-class) — not a slow flagship
- [ ] Clipboard + screen + selected-text context enabled only where the prompt needs them — and only if you're OK sending that material to the cleanup provider (hosted Cerebras/Groq/Gemini). Prefer local enhancement or context off for secret-heavy work.
- [ ] Custom assistant endpoint verified under AI Models → Custom (if used)
- [ ] History sample: Default rows show prompt name and successful enhance text

## Dictionary

- [ ] Merge starter emoji / ellipsis / tech replacements
- [ ] Add personal proper nouns to Vocabulary
- [ ] Test in **Brief**: `exhaling emoji` → emoji character without AI
- [ ] If another app reads `dictionary.store`, confirm it still loads after edits

## Import pack

- [ ] `python3 ~/.autovault/skills/voiceink-2-upgrade/scripts/validate_backup.py <export.json>` passes (or path from `autovault skill which voiceink-2-upgrade validate_backup.py`)
- [ ] Scrub secrets / hyper-personal replacements before sharing the JSON
- [ ] Import Modes + Prompts + Dictionary
- [ ] Re-verify Custom provider after import on a new machine

## Smoke tests

- [ ] Default in Cursor: path-y speech keeps `file.js` / `.env` / `/commands` literal
- [ ] Brief in Messages: short casual line, emoji replacement works
- [ ] Assistant trigger: Respond panel, tools/hub reachable if Custom
- [ ] German phrase (or `auf deutsch` Mode): umlauts preserved, not translated
- [ ] No new Apple Speech download errors in History
