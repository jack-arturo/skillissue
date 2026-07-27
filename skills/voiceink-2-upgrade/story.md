---
name: voiceink-2-upgrade
visibility: public
provenance: house
featured: true
title: "VoiceInk 2.0 Upgrade"
summary: >-
  Field notes for surviving VoiceInk 2.0: Parakeet Modes, Apple Speech trap,
  prompt=<none> failures, Dictionary replacements, Hub Parakeet shared STT, and
  a settings-backup validator.
category: desktop
tags: [voiceink, macos, dictation, migration, parakeet]
related: [flashspace, raycast]
first_used: 2026-07
---

## Why it exists

VoiceInk 2.0 is worth the upgrade — Modes are the right model — but the cutover
will happily strand you on Apple Speech, wipe Mode storage, and fail every AI
cleanup with an empty prompt UUID.

I hit all of that in one evening. Parakeet V3 was already on disk under
FluidAudio. History still screamed about English (United States) downloads.
Enhancement rows showed `prompt=<none>` and "Failed to decode response." Brief
Modes never ran the cleanup prompt, so spoken "exhaling emoji" stayed as words
until the Dictionary replacements did the job.

This skill is the checklist I wish I'd had before opening the 2.0 build: snapshot
first, kill Apple Speech on active Modes, give every enhancing Mode a real
prompt, put deterministic fixes (emoji, ellipsis, `mcp-client.js`) in word
replacements, and validate the backup JSON before you re-import it.

## History

### 1.1.0 — 2026-07

Hub Parakeet path: Custom Transcription → OpenAI
`/v1/audio/transcriptions` on a warm local MLX server; unload FluidAudio to
avoid two runtimes; document bare-host 404 and empty Test-probe ffmpeg failures.

### 1.0.0 — 2026-07

First public cut after a live Mac upgrade to VoiceInk 2.0 (build ~205).

- Documented Apple Speech vs Parakeet / FluidAudio paths
- Mode map: Default / Brief / Assistant / Submit / Email / optional German
- Cleanup prompt template (emoji, ellipsis, literal paths, mixed EN+DE)
- Starter replacements JSON + `scripts/validate_backup.py`
- Notes that Custom providers live in prefs + Keychain, not the backup schema

## How Jack actually uses it

Default Mode: **Hub Parakeet** (local OpenAI transcriptions on `:8178`) when the
LaunchAgent/hub server is warm; otherwise FluidAudio Parakeet V3. Cerebras
`gpt-oss-120b` cleanup, System Default-style prompt, language `auto`. Clipboard +
screen context on for register detection — eyes open that hosted cleanup sees it.

Brief: enhancement off, messaging apps, Dictionary replacements for emoji so
WhatsApp stays fast.

Ask AutoJack: Custom OpenAI-compatible **chat** endpoint on localhost, Respond
output — not the same provider as cleanup, and not the same as Hub Parakeet STT.

Dictionary is the shared lexicon other local STT tools can read read-only from
`dictionary.store`. FluidAudio CoreML weights are **not** the same stack as
parakeet-mlx; sharing happens at the HTTP server, not the weight files.

## What it is not

Not VoiceInk support. Not a dump of anyone's full personal dictionary or API
keys. Not a promise that settings import recreates Custom provider Keychain
entries on a fresh Mac — you still Verify under AI Models → Custom.
