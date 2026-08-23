# Asset Generation

Exact commands for generating every asset type used in a video project: background music, per-scene voiceover, scene images, AI video clips (b-roll and chained sequences), talking-head narrator clips, image editing, and upscaling. Run all of these from the toolkit root — see the main SKILL.md for the `--progress json` and long-running-task conventions these commands rely on, and [troubleshooting.md](troubleshooting.md) for the full progress-stage reference and per-tool cost estimates.

### Step 4: Generate Assets

**CRITICAL: All commands below MUST be run from the toolkit root, not the project directory.**

```bash
cd "$VIDEO_TOOLKIT_ROOT"
```

#### 4a. Background Music

Default provider is **acemusic** (official cloud API, free key). No GPU required. Falls back to Modal/RunPod for self-hosted.

```bash
cd "$VIDEO_TOOLKIT_ROOT"

# Using acemusic cloud API (default — best quality, XL Turbo 4B model)
.venv/bin/python tools/music_gen.py \
  --preset corporate-bg \
  --duration 90 \
  --output projects/PROJECT_NAME/public/audio/bg-music.mp3 \
  --progress json

# Or with custom prompt and thinking mode
.venv/bin/python tools/music_gen.py \
  --prompt "Subtle ambient tech, soft synth pads" \
  --duration 90 \
  --output projects/PROJECT_NAME/public/audio/bg-music.mp3 \
  --progress json

# Fall back to self-hosted Modal if no acemusic key
.venv/bin/python tools/music_gen.py \
  --preset corporate-bg \
  --duration 90 \
  --output projects/PROJECT_NAME/public/audio/bg-music.mp3 \
  --cloud modal --progress json
```

Presets: `corporate-bg`, `upbeat-tech`, `ambient`, `dramatic`, `tension`, `hopeful`, `cta`, `lofi`.

Setup: `echo "ACEMUSIC_API_KEY=your_key" >> .env` (get free key at acemusic.ai/api-key).

#### 4b. Voiceover (per-scene)

Generate ONE .mp3 file PER SCENE. Do NOT generate a single voiceover file.

```bash
cd "$VIDEO_TOOLKIT_ROOT"

# Scene 01
.venv/bin/python tools/qwen3_tts.py \
  --text "The voiceover text for scene one." \
  --speaker Ryan --tone warm \
  --output projects/PROJECT_NAME/public/audio/scenes/01.mp3 \
  --cloud modal --progress json

# Scene 02
.venv/bin/python tools/qwen3_tts.py \
  --text "The voiceover text for scene two." \
  --speaker Ryan --tone warm \
  --output projects/PROJECT_NAME/public/audio/scenes/02.mp3 \
  --cloud modal --progress json

# ... repeat for each scene
```

**Speakers:** `Ryan`, `Aiden`, `Vivian`, `Serena`, `Uncle_Fu`, `Dylan`, `Eric`, `Ono_Anna`, `Sohee`
**Tones:** `neutral`, `warm`, `professional`, `excited`, `calm`, `serious`, `storyteller`, `tutorial`

For voice cloning (needs a reference recording):
```bash
cd "$VIDEO_TOOLKIT_ROOT"
.venv/bin/python tools/qwen3_tts.py \
  --text "Text to speak" \
  --ref-audio assets/voices/reference.m4a \
  --ref-text "Exact transcript of the reference audio" \
  --output projects/PROJECT_NAME/public/audio/scenes/01.mp3 \
  --cloud modal --progress json
```

#### 4c. Scene Images

```bash
cd "$VIDEO_TOOLKIT_ROOT"
.venv/bin/python tools/flux2.py \
  --prompt "Dark tech background with blue geometric grid, cinematic lighting" \
  --width 1920 --height 1080 \
  --output projects/PROJECT_NAME/public/images/title-bg.png \
  --cloud modal --progress json
```

Image presets (use `--preset` instead of `--prompt --width --height`):
`title-bg`, `problem`, `solution`, `demo-bg`, `stats-bg`, `cta`, `thumbnail`, `portrait-bg`

```bash
cd "$VIDEO_TOOLKIT_ROOT"
.venv/bin/python tools/flux2.py \
  --preset title-bg \
  --output projects/PROJECT_NAME/public/images/title-bg.png \
  --cloud modal --progress json
```

#### 4d. Video Clips — B-Roll & Animated Backgrounds (optional)

Generate AI video clips for b-roll cutaways, animated slide backgrounds, or intro/outro sequences:

```bash
cd "$VIDEO_TOOLKIT_ROOT"

# B-roll clip from text
.venv/bin/python tools/ltx2.py \
  --prompt "Aerial drone shot over a European city at golden hour, cinematic wide angle" \
  --output projects/PROJECT_NAME/public/videos/broll-europe.mp4 \
  --cloud modal --progress json

# Animate a slide/screenshot (image-to-video)
.venv/bin/python tools/ltx2.py \
  --prompt "Gentle particle effects, soft ambient light shifts, very slight camera drift" \
  --input projects/PROJECT_NAME/public/images/title-bg.png \
  --output projects/PROJECT_NAME/public/videos/animated-title.mp4 \
  --cloud modal --progress json

# Abstract intro/outro background
.venv/bin/python tools/ltx2.py \
  --prompt "Dark moody abstract background with flowing blue light streaks, bokeh particles, cinematic" \
  --output projects/PROJECT_NAME/public/videos/intro-bg.mp4 \
  --cloud modal --progress json
```

Use in Remotion compositions with `<OffthreadVideo>`:
```tsx
<OffthreadVideo src={staticFile('videos/broll-europe.mp4')} />
```

**LTX-2 rules:**
- Max ~8 seconds per clip (193 frames at 24fps). Default is ~5s (121 frames).
- Width/height must be divisible by 64. Default: 768x512.
- ~$0.20-0.25 per clip, ~2.5 min generation time.
- Cold start ~60-90s. Subsequent clips on warm GPU are faster.
- Generated audio is ambient only — use voiceover/music tools for speech and music.
- ~30% of generations may have training data artifacts (logos/text). Re-run with `--seed` to vary.

#### 4d-chain. Chained Video Sequences (visual continuity)

Generate a sequence of video clips where each scene flows from the last frame of the previous one. **This runs as a single command** — no manual nudging between scenes.

```bash
cd "$VIDEO_TOOLKIT_ROOT"

# Chain scenes 1-30 from a directory of FLUX images
.venv/bin/python tools/chain_video.py \
  --scenes-dir projects/PROJECT_NAME/public/images/scenes/ \
  --output-dir projects/PROJECT_NAME/public/videos/chain/ \
  --prompt "Cinematic continuation, flowing transition" \
  --start 1 --end 30 \
  --progress json

# Resume from scene 10 (skips existing files automatically)
.venv/bin/python tools/chain_video.py \
  --scenes-dir projects/PROJECT_NAME/public/images/scenes/ \
  --output-dir projects/PROJECT_NAME/public/videos/chain/ \
  --start 10 --end 30 \
  --progress json

# Per-scene prompts from JSON file
.venv/bin/python tools/chain_video.py \
  --scenes-dir projects/PROJECT_NAME/public/images/scenes/ \
  --output-dir projects/PROJECT_NAME/public/videos/chain/ \
  --prompts-file projects/PROJECT_NAME/scenes.json \
  --progress json

# Chain from an existing clip (no scene images needed)
.venv/bin/python tools/chain_video.py \
  --first-clip output/chain-04.mp4 \
  --output-dir output/ \
  --start 5 --end 30 \
  --prompt "Celtic mythology, flowing transition" \
  --progress json
```

**Prompts file format** (`scenes.json`):
```json
{"1": "Ancient stone circle at dawn", "2": "Celtic spirals emerge from stone", "3": "Portal opens with golden light"}
```

**Chain rules:**
- Extracts last frame from scene N, feeds as `--input` to scene N+1 via LTX-2
- Skips scenes that already exist on disk (safe to resume)
- Falls back to scene images from `--scenes-dir` if chaining fails
- Use `--prefix` to set output filename prefix (default: `chain`)
- ~2.5 min per scene, ~$0.20-0.25 per clip
- Extra args (e.g. `--negative-prompt`, `--seed`) are passed through to ltx2.py

**CRITICAL: Style drift in chained sequences.** LTX-2 has ~30% training data contamination (anime/Asian content). Generic prompts like "cinematic transition" will drift toward anime aesthetics within 5-10 chained scenes. To prevent this:

1. **ALWAYS use `--prompts-file`** with specific per-scene prompts — never a single generic prompt for the whole chain
2. **ALWAYS add `--negative-prompt`** to exclude unwanted styles:
   ```
   --negative-prompt "anime, manga, asian, cartoon, illustration, watermark, text, logo"
   ```
3. Each per-scene prompt should include **strong style anchors** (e.g. "Irish landscape, Celtic knotwork, oil painting style") not just subject descriptions

**Keep the chain in one yielded execution session.** Do not break it into
per-scene calls or detach it from the task:

```bash
cd "$VIDEO_TOOLKIT_ROOT"
.venv/bin/python tools/chain_video.py \
  --scenes-dir /path/to/images/ \
  --output-dir /path/to/output/ \
  --prompts-file scenes.json \
  --progress json
```

Use the host's pollable process/session mechanism with a roughly ten-second
yield interval:

- Read each `--progress json` update from stderr (`stage`, `pct`, and `msg`).
- Report progress to the user ("Scene 05/30 complete, 17%").
- Poll the same process session again.
- Repeat until `"stage":"complete"` appears.

Use the same attached-session pattern for every long-running command, including
batch FLUX and SadTalker.

#### 4e. Talking Head Narrator (optional)

Generate a presenter portrait, then animate per-scene clips:

```bash
cd "$VIDEO_TOOLKIT_ROOT"

# 1. Generate portrait
.venv/bin/python tools/flux2.py \
  --prompt "Professional presenter portrait, clean style, dark background, facing camera, upper body" \
  --width 1024 --height 576 \
  --output projects/PROJECT_NAME/public/images/presenter.png \
  --cloud modal --progress json

# 2. Generate per-scene narrator clips (one per scene, NOT one long video)
.venv/bin/python tools/sadtalker.py \
  --image projects/PROJECT_NAME/public/images/presenter.png \
  --audio projects/PROJECT_NAME/public/audio/scenes/01.mp3 \
  --preprocess full --still --expression-scale 0.8 \
  --output projects/PROJECT_NAME/public/narrator-01.mp4 \
  --cloud modal --progress json

# Repeat for each scene that needs a narrator
```

**SadTalker rules — follow these exactly:**
- **ALWAYS** use `--preprocess full` (default `crop` outputs a square, wrong aspect ratio)
- **ALWAYS** use `--still` (reduces head movement, looks professional)
- **ALWAYS** generate per-scene clips (6-15s each), NEVER one long video
- Processing: ~3-4 min per 10s of audio on Modal A10G
- `--expression-scale 0.8` keeps expressions subtle (range 0.0-1.5)

#### 4e. Image Editing (optional)

Create scene variants from existing images:

```bash
cd "$VIDEO_TOOLKIT_ROOT"
.venv/bin/python tools/image_edit.py \
  --input projects/PROJECT_NAME/public/images/title-bg.png \
  --prompt "Make it darker with red tones, more ominous" \
  --output projects/PROJECT_NAME/public/images/problem-bg.png \
  --cloud modal --progress json
```

#### 4f. Upscaling (optional)

```bash
cd "$VIDEO_TOOLKIT_ROOT"
.venv/bin/python tools/upscale.py \
  --input projects/PROJECT_NAME/public/images/some-image.png \
  --output projects/PROJECT_NAME/public/images/some-image-4x.png \
  --scale 4 --cloud modal --progress json
```
