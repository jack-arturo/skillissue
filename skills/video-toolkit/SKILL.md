---
name: video-toolkit
description: Create professional local video projects with a configurable video toolkit, including AI voiceover, images, music, talking heads, chained clips, progress monitoring, and Remotion rendering.
license: MIT
tags: [video, media, remotion, modal, image-generation, voiceover, music]
agents: [autojack, claude-code, codex]
category: media
metadata:
  version: "1.0.0"
capabilities:
  network: true
  filesystem: readwrite
  tools: [Bash, Read, Edit]
requires-secrets:
  - name: ACEMUSIC_API_KEY
    description: Optional ACE Music API key for hosted music generation.
    required: false
  - name: MODAL_FLUX2_ENDPOINT_URL
    description: Optional Modal endpoint for FLUX image generation.
    required: false
  - name: MODAL_QWEN3_TTS_ENDPOINT_URL
    description: Optional Modal endpoint for Qwen voice generation.
    required: false
  - name: MODAL_MUSIC_GEN_ENDPOINT_URL
    description: Optional Modal endpoint for self-hosted music generation.
    required: false
  - name: MODAL_SADTALKER_ENDPOINT_URL
    description: Optional Modal endpoint for talking-head generation.
    required: false
  - name: MODAL_LTX2_ENDPOINT_URL
    description: Optional Modal endpoint for text-to-video and chained clips.
    required: false
resources:
  - path: story.md
    type: file
  - path: references/setup.md
    type: file
  - path: references/project-workflow.md
    type: file
  - path: references/asset-generation.md
    type: file
  - path: references/composition-patterns.md
    type: file
  - path: references/troubleshooting.md
    type: file
---

# Video Toolkit

Create professional explainer videos from a text brief. The toolkit uses open-source AI models on cloud GPUs (Modal or RunPod) for voiceover, image generation, music, and talking head animation. Remotion (React) handles composition and rendering.

## Critical: local toolkit path

Resolve the local checkout once and keep every toolkit-relative path anchored to
it. The default below matches the standard local checkout but remains
overrideable:

```bash
: "${VIDEO_TOOLKIT_ROOT:?Set VIDEO_TOOLKIT_ROOT to the installed toolkit directory}"
export VIDEO_TOOLKIT_ROOT
test -d "$VIDEO_TOOLKIT_ROOT" || { printf 'Toolkit not found: %s\n' "$VIDEO_TOOLKIT_ROOT" >&2; exit 1; }
cd "$VIDEO_TOOLKIT_ROOT"
```

**NEVER run tool commands from inside a project directory.** Tools resolve paths relative to the toolkit root.

## CRITICAL: Progress Reporting

**ALWAYS add `--progress json` to every cloud GPU tool command.** This gives you structured JSON Lines on stderr so you can monitor job status, detect stuck jobs, and report progress to the user in real-time.

```bash
# CORRECT — always include --progress json
.venv/bin/python tools/music_gen.py --preset corporate-bg --duration 60 --output bg.mp3 --progress json

# WRONG — no visibility into job status
.venv/bin/python tools/music_gen.py --preset corporate-bg --duration 60 --output bg.mp3
```

Tools that support `--progress json`: `music_gen.py`, `qwen3_tts.py`, `flux2.py`, `upscale.py`, `sadtalker.py`, `image_edit.py`, `dewatermark.py`, `ltx2.py`, `chain_video.py`.

See [references/troubleshooting.md](references/troubleshooting.md) for the full output format and stage definitions.

## Critical: keep long-running tasks attached

Any command that can take more than 30 seconds must run in the host's yielded,
pollable execution session. This includes batch FLUX generation, chained video,
SadTalker, music generation, and multi-scene pipelines.

```bash
cd "$VIDEO_TOOLKIT_ROOT"
.venv/bin/python tools/chain_video.py --output-dir /path/ --progress json
```

The monitoring loop is:

1. Start the command with a roughly ten-second yield interval.
2. Read the `--progress json` output — look for `"stage":"item"` (scene complete) or `"stage":"complete"` (all done)
3. Report progress to the user ("Scene 05/30 complete, 17%")
4. Poll the same execution session again.
5. Repeat until `"stage":"complete"`

Do not detach the process and promise to monitor it later. Keep the same session
attached until the command completes or fails.

## What are you trying to do?

- **Set up the toolkit for the first time, or check whether Modal/env endpoints are configured** → [references/setup.md](references/setup.md)
- **Start a new video project** — brand recall, project scaffolding, config, voiceover script, timing sync, still-frame review, render → [references/project-workflow.md](references/project-workflow.md)
- **Generate a specific asset** — background music, per-scene voiceover, scene images, AI video clips (b-roll or chained sequences), talking-head narrator, image editing, upscaling → [references/asset-generation.md](references/asset-generation.md)
- **Write Remotion composition code** — per-scene audio, narrator picture-in-picture, transitions → [references/composition-patterns.md](references/composition-patterns.md)
- **Debug a failure, read the `--progress json` stage table, or check Modal cost estimates** → [references/troubleshooting.md](references/troubleshooting.md)

## Reference files

| File | Read this when... |
|---|---|
| `references/setup.md` | First-time setup: verify state, install deps, configure/deploy Modal endpoints, quick test |
| `references/project-workflow.md` | Creating a project end to end: brand recall → project → config → script → (assets) → timing sync → review → render |
| `references/asset-generation.md` | Generating music, voiceover, images, video clips, chained sequences, talking-head narrator clips, image edits, or upscales — exact tool invocations and flags |
| `references/composition-patterns.md` | Wiring generated assets into a Remotion composition |
| `references/troubleshooting.md` | A command failed, you need the progress-JSON stage reference, or you need per-tool cost estimates |
