---
title: "One Parakeet, two clients"
status: concept
blog: drunk.support
created: 2026-07-27
related_skill: voiceink-2-upgrade
tags: [voiceink, parakeet, macos, autohub, ram, dictation]
---

# Blog concept — drunk.support

**Working titles (pick one):**

- One Parakeet, two clients
- VoiceInk 2.0 ate my Modes, then my RAM
- Stop running two speech models on one Mac

**Status:** outline only — not scheduled for AutoJack publish.

## Hook (draft)

I upgraded VoiceInk to 2.0, spent an evening fighting Apple Speech for a model
that was already on disk, then noticed the Mac was happily warming *two*
Parakeets — FluidAudio inside VoiceInk and MLX inside the hub.

## TL;DR

1. VoiceInk 2.0 Modes are worth it; export settings before the upgrade.
2. `prompt=<none>` always fails enhancement — every enhancing Mode needs a real prompt.
3. Point VoiceInk Custom Transcription at a shared local OpenAI endpoint:
   `http://127.0.0.1:8178/v1/audio/transcriptions` (full path, not the bare host).
4. Keep one warm MLX Parakeet via LaunchAgent; unload FluidAudio so you don’t
   pay ~1 GB twice.
5. Operator runbook: [voiceink-2-upgrade](https://skillissue.sh/skills/voiceink-2-upgrade/).

## Arc (drunk.support template)

1. **Hook** — upgrade night; Apple Speech trap; then two Parakeets.
2. **TL;DR** — numbered list above.
3. **Backstory** — Modes redesign, Power Modes → Modes, hub already had
   `parakeet-mlx` on `:8178` for voice agents.
4. **Dead ends**
   - “Download required for English (United States)” while FluidAudio V3 existed
   - Enhancement decode failures with empty `selectedPrompt`
   - Custom endpoint `localhost:8178` → HTTP 404
   - VoiceInk Test probe: empty / headerless “wav” → ffmpeg stderr as HTTP 500
5. **Pivot** — one server, two protocols: hub `/inference`, VoiceInk
   `/v1/audio/transcriptions`; normalize uploads; LaunchAgent KeepAlive.
6. **How it works** — short diagram (VoiceInk + hub voice → Parakeet); endpoint
   table; Mode points at Hub Parakeet.
7. **Numbers**
   - FluidAudio on disk ~905 MB (v2+v3) until deleted
   - Hub Parakeet RSS ~1 GB when warm
   - Runtime win only if Modes use Hub Parakeet *and* FluidAudio isn’t loaded
8. **What’s working / isn’t / next**
   - Working: shared STT, VoiceInk without `voice:dev` if LaunchAgent is up
   - Isn’t: Custom HTTP ≠ FluidAudio realtime partials
   - Next: maybe delete unused FluidAudio dirs after a week of Hub-only
9. **Caveats** — not VoiceInk support; dummy API key is fine locally; unload
   LaunchAgent when you want the RAM back (`launchctl bootout …`).
10. **CTA** — install the skill; link skillissue.sh; optional System Configuration
    `./scripts/install.sh parakeet` for the agent.
11. **Sign-off** — `— Jack`

## Pull quotes / scars worth keeping

- “Apple Speech ≠ Parakeet.”
- “Bare `:8178` is a 404 with extra steps.”
- “Empty Test probe should not dump an ffmpeg version banner into the UI.”

## Assets to gather before drafting

- [ ] Clean screenshot: VoiceInk Custom Transcription modal with full URL
- [ ] Optional: Activity Monitor before/after unloading FluidAudio
- [ ] skillissue install pin from the live skill page after 1.1.0 ships

## Not for this post

- Full Mode map / cleanup prompt (link the skill)
- AutoJack publish / social blast (separate pass)
- Deleting anyone else’s FluidAudio trees automatically
